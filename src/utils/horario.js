const Horario = require("../models/Horario");
const Usuario = require("../models/Usuario");
const Configuracion = require("../models/Configuracion");
const tz = require("./timezone");

async function getTurnos(empleadoId, fechaStr) {
  // 1) Buscar horario especifico para esta fecha
  let doc = await Horario.findOne({
    empleado: empleadoId,
    tipo: "especifico",
    fecha: fechaStr,
  }).lean();
  if (doc) return doc.turnos;

  // 2) Buscar horario semanal para este dia de semana
  const dia = new Date(fechaStr + "T12:00:00").getDay();
  doc = await Horario.findOne({
    empleado: empleadoId,
    tipo: "semanal",
    diaSemana: dia,
  }).lean();
  if (doc) return doc.turnos;

  // 3) Fallback: usar horaInicio del empleado o config general
  const empleado = await Usuario.findById(empleadoId).lean();
  const configs = await Configuracion.find({
    clave: { $in: ["hora_inicio_general", "tolerancia_general", "descuento_por_minuto"] },
  }).lean();
  const cfg = {};
  configs.forEach((c) => (cfg[c.clave] = c.valor));

  return [
    {
      horaInicio: empleado?.horaInicio || cfg.hora_inicio_general || "08:00",
      tolerancia: empleado?.toleranciaMinutos ?? parseInt(cfg.tolerancia_general || "10"),
      descuentoPorMinuto: empleado?.descuentoPorMinuto ?? parseFloat(cfg.descuento_por_minuto || "0.50"),
    },
  ];
}

async function getTurnosHoy(empleadoId) {
  return getTurnos(empleadoId, tz.todayStr());
}

module.exports = { getTurnos, getTurnosHoy };
