const Usuario = require("../models/Usuario");
const Asistencia = require("../models/Asistencia");
const Configuracion = require("../models/Configuracion");
const tz = require("../utils/timezone");
const horario = require("../utils/horario");

async function marcacionView(req, res) {
  const mongoose = require("mongoose");
  const userId = new mongoose.Types.ObjectId(req.session.user.id);
  const doc = await Usuario.findById(userId).lean();
  const empleado = {
    ...doc,
    hora_inicio: doc.horaInicio,
    tolerancia_minutos: doc.toleranciaMinutos,
    descuento_por_minuto: doc.descuentoPorMinuto,
  };

  const fechaStr = tz.todayStr();
  const config = await getConfigMap();
  const tzCfg = await tz.getConfig();

  const turnosHoy = await horario.getTurnosHoy(userId);
  const marcacionesHoy = await Asistencia.find({
    empleado: userId,
    fecha: fechaStr,
  })
    .sort({ turnoIndex: 1 })
    .lean();

  const marcados = {};
  marcacionesHoy.forEach((m) => (marcados[m.turnoIndex] = m));

  const turnosConEstado = turnosHoy.map((t, i) => ({
    ...t,
    index: i,
    marcado: !!marcados[i],
    asistencia: marcados[i]
      ? { ...marcados[i], horaMarcacion: tz.formatHora(marcados[i].horaMarcacion) }
      : null,
  }));

  const todosMarcados = turnosConEstado.every((t) => t.marcado);

  const now = tz.now();
  const horaActual = now.format("HH:mm:ss");

  // Obtener la asistencia del TURNO ACTUAL (ultimo turno marcado o el siguiente)
  // Para compatibilidad con la vista anterior, pasamos el primer turno como asistenciaHoy
  const primerMarcado = turnosConEstado.find((t) => t.marcado);
  const asistenciaHoy = primerMarcado?.asistencia || null;

  res.render("empleado/marcacion", {
    empleado,
    turnos: turnosConEstado,
    todosMarcados,
    asistenciaHoy,
    config: { ...config, ...tzCfg },
    horaActual,
    retraso: req.query.retraso,
  });
}

async function marcar(req, res) {
  const mongoose = require("mongoose");
  const userId = req.session.user.id;
  const empleadoId = new mongoose.Types.ObjectId(userId);

  const empleado = await Usuario.findById(empleadoId).lean();
  if (!empleado) return res.redirect("/empleado?error=Empleado no encontrado");

  const fechaStr = tz.todayStr();
  const horaStr = tz.timeStr();

  const turnosHoy = await horario.getTurnosHoy(empleadoId);
  const marcacionesHoy = await Asistencia.find({
    empleado: empleadoId,
    fecha: fechaStr,
  }).lean();

  const marcadosSet = new Set(marcacionesHoy.map((m) => m.turnoIndex));

  // Find next unmarked turno
  let turnoIndex = -1;
  let turno = null;
  for (let i = 0; i < turnosHoy.length; i++) {
    if (!marcadosSet.has(i)) {
      turnoIndex = i;
      turno = turnosHoy[i];
      break;
    }
  }

  if (turnoIndex === -1) {
    return res.redirect("/empleado?error=Ya marcaste todos tus turnos hoy");
  }

  const horaInicio = turno.horaInicio;
  const tolerancia = turno.tolerancia;

  const minInicio = tz.horasToMinutes(horaInicio);
  const minActual = tz.horasToMinutes(horaStr);
  const minutosRetraso = Math.max(0, minActual - (minInicio + tolerancia));

  await Asistencia.create({
    empleado: empleadoId,
    fecha: fechaStr,
    horaMarcacion: horaStr,
    horaEsperada: horaInicio,
    minutosRetraso,
    turnoIndex,
  });

  const totalTurnos = turnosHoy.length;
  const marcadosAhora = marcadosSet.size + 1;
  let msg;
  if (minutosRetraso > 0) {
    msg = `Turno ${turnoIndex + 1} registrado con ${minutosRetraso} min de retraso`;
  } else {
    msg = `Turno ${turnoIndex + 1} registrado a tiempo`;
  }

  if (marcadosAhora < totalTurnos) {
    msg += `. Te falta${totalTurnos - marcadosAhora > 1 ? "n" : ""} ${totalTurnos - marcadosAhora} turno${totalTurnos - marcadosAhora > 1 ? "s" : ""} m\u00e1s`;
  } else {
    msg += ". Todos los turnos registrados hoy";
  }

  res.redirect(`/empleado?success=${encodeURIComponent(msg)}`);
}

async function historialView(req, res) {
  const mongoose = require("mongoose");
  const userId = new mongoose.Types.ObjectId(req.session.user.id);

  const page = parseInt(req.query.page) || 1;
  const limit = 15;
  const skip = (page - 1) * limit;

  const total = await Asistencia.countDocuments({ empleado: userId });
  const totalPages = Math.ceil(total / limit);

  const registros = await Asistencia.find({ empleado: userId })
    .sort({ fecha: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const resumen = await Asistencia.aggregate([
    { $match: { empleado: userId } },
    {
      $group: {
        _id: null,
        total_dias: { $sum: 1 },
        tardanzas: {
          $sum: { $cond: [{ $gt: ["$minutosRetraso", 0] }, 1, 0] },
        },
        total_minutos_retraso: { $sum: "$minutosRetraso" },
      },
    },
  ]);

  const registrosFormateados = registros.map((r) => ({
    ...r,
    fecha: tz.formatFecha(r.fecha),
    horaMarcacion: tz.formatHora(r.horaMarcacion),
    horaEsperada: r.horaEsperada,
  }));

  res.render("empleado/historial", {
    registros: registrosFormateados,
    resumen: resumen[0] || { total_dias: 0, tardanzas: 0, total_minutos_retraso: 0 },
    page,
    totalPages,
  });
}

async function getConfigMap() {
  const configs = await Configuracion.find().lean();
  const map = {};
  configs.forEach((c) => (map[c.clave] = c.valor));
  return map;
}

module.exports = { marcacionView, marcar, historialView };
