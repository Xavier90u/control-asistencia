const Usuario = require("../models/Usuario");
const Asistencia = require("../models/Asistencia");
const Configuracion = require("../models/Configuracion");
const tz = require("../utils/timezone");

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

  const asistRaw = await Asistencia.findOne({
    empleado: userId,
    fecha: fechaStr,
  }).lean();

  const asistenciaHoy = asistRaw
    ? {
        ...asistRaw,
        horaMarcacion: tz.formatHora(asistRaw.horaMarcacion),
      }
    : null;

  const now = tz.now();
  const horaActual = now.format("HH:mm:ss");

  res.render("empleado/marcacion", {
    empleado,
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

  const existing = await Asistencia.findOne({
    empleado: empleadoId,
    fecha: fechaStr,
  });
  if (existing) return res.redirect("/empleado?error=Ya marcaste entrada hoy");

  const config = await getConfigMap();

  const horaInicio =
    empleado.horaInicio || config.hora_inicio_general || "08:00";
  const tolerancia =
    empleado.toleranciaMinutos ??
    parseInt(config.tolerancia_general || "10");

  const minInicio = tz.horasToMinutes(horaInicio);
  const minActual = tz.horasToMinutes(horaStr);
  const minutosRetraso = Math.max(0, minActual - (minInicio + tolerancia));

  await Asistencia.create({
    empleado: empleadoId,
    fecha: fechaStr,
    horaMarcacion: horaStr,
    horaEsperada: horaInicio,
    minutosRetraso,
  });

  if (minutosRetraso > 0) {
    res.redirect(`/empleado?success=Entrada registrada&retraso=${minutosRetraso}`);
  } else {
    res.redirect("/empleado?success=Entrada registrada a tiempo");
  }
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
