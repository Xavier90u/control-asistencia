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

  const franjasHoy = await horario.getFranjasHoy(userId);
  const marcacionesHoy = await Asistencia.find({ empleado: userId, fecha: fechaStr }).lean();
  const marcadas = new Set(marcacionesHoy.map((m) => m.franja));

  const now = tz.now();
  const minActual = tz.horasToMinutes(now.format("HH:mm"));

  const franjasConEstado = franjasHoy.map((f) => {
    const minFranja = tz.horasToMinutes(f);
    const disponible = minActual >= minFranja - 10;
    const marcada = marcadas.has(f);
    const retraso = Math.max(0, minActual - minFranja);
    return { franja: f, marcada, disponible, retraso_bruto: retraso };
  });

  const todosMarcados = franjasConEstado.every((f) => f.marcada);

  res.render("empleado/marcacion", {
    empleado,
    franjas: franjasConEstado,
    todosMarcados,
    config: { ...config, ...tzCfg },
    retraso: req.query.retraso,
  });
}

async function marcar(req, res) {
  const mongoose = require("mongoose");
  const userId = req.session.user.id;
  const empleadoId = new mongoose.Types.ObjectId(userId);
  const { franja, lat, lng } = req.body;

  if (!franja) return res.redirect("/empleado?error=Selecciona una franja horaria");

  const empleado = await Usuario.findById(empleadoId).lean();
  if (!empleado) return res.redirect("/empleado?error=Empleado no encontrado");

  const fechaStr = tz.todayStr();
  const horaStr = tz.timeStr();

  // Validar que la franja existe para hoy
  const franjasHoy = await horario.getFranjasHoy(empleadoId);
  if (!franjasHoy.includes(franja)) {
    return res.redirect("/empleado?error=Esta franja no est\u00e1 disponible hoy");
  }

  // Validar que no haya marcado ya esta franja hoy
  const yaMarcada = await Asistencia.findOne({ empleado: empleadoId, fecha: fechaStr, franja });
  if (yaMarcada) {
    return res.redirect("/empleado?error=Ya marcaste esta franja hoy");
  }

  // Regla de 10 minutos
  const minActual = tz.horasToMinutes(horaStr);
  const minFranja = tz.horasToMinutes(franja);
  if (minActual < minFranja - 10) {
    const esperar = tz.minutosToStr(minFranja - 10);
    return res.redirect(`/empleado?error=Aún no puedes marcar para las ${franja}. Vuelve a las ${esperar}`);
  }

  // Calcular retraso
  const tolerancia = empleado.toleranciaMinutos ?? parseInt((await getConfigMap()).tolerancia_general || "10");
  const minutosRetraso = Math.max(0, minActual - (minFranja + tolerancia));

  await Asistencia.create({
    empleado: empleadoId, fecha: fechaStr, horaMarcacion: horaStr, horaEsperada: franja,
    minutosRetraso, franja, latitud: lat ? parseFloat(lat) : undefined, longitud: lng ? parseFloat(lng) : undefined,
  });

  let msg;
  if (minutosRetraso > 0) {
    msg = `Franja ${franja} registrada con ${minutosRetraso} min de retraso`;
  } else {
    msg = `Franja ${franja} registrada a tiempo`;
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
    { $group: { _id: null, total_dias: { $sum: 1 }, tardanzas: { $sum: { $cond: [{ $gt: ["$minutosRetraso", 0] }, 1, 0] } }, total_minutos_retraso: { $sum: "$minutosRetraso" } } },
  ]);
  const registrosFormateados = registros.map((r) => ({
    ...r, fecha: tz.formatFecha(r.fecha), horaMarcacion: tz.formatHora(r.horaMarcacion), horaEsperada: r.horaEsperada,
  }));
  res.render("empleado/historial", {
    registros: registrosFormateados,
    resumen: resumen[0] || { total_dias: 0, tardanzas: 0, total_minutos_retraso: 0 },
    page, totalPages,
  });
}

async function getConfigMap() {
  const configs = await Configuracion.find().lean();
  const map = {};
  configs.forEach((c) => (map[c.clave] = c.valor));
  return map;
}

module.exports = { marcacionView, marcar, historialView };
