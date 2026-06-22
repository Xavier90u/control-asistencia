const Horario = require("../models/Horario");
const Usuario = require("../models/Usuario");
const Area = require("../models/Area");
const tz = require("./timezone");

async function getFranjas(empleadoId, fechaStr) {
  const empleado = await Usuario.findById(empleadoId).lean();
  if (!empleado) return [];

  const dia = new Date(fechaStr + "T12:00:00").getDay();

  // 1) Buscar horario personal del docente para ese dia
  const horarioDoc = await Horario.findOne({
    empleado: empleadoId,
    diaSemana: dia,
  }).lean();

  if (horarioDoc && horarioDoc.franjas && horarioDoc.franjas.length > 0) {
    return horarioDoc.franjas;
  }

  // 2) Fallback: franjas del area
  if (empleado.area) {
    const area = await Area.findById(empleado.area).lean();
    if (area) {
      const franjas = area.franjasPorDia?.get?.(String(dia)) || area.franjasPorDia?.[dia];
      if (franjas && franjas.length > 0) return franjas;
    }
  }

  // 3) Ultimo fallback: horaInicio del empleado como unica franja
  if (empleado.horaInicio) return [empleado.horaInicio];

  return [];
}

async function getFranjasHoy(empleadoId) {
  return getFranjas(empleadoId, tz.todayStr());
}

module.exports = { getFranjas, getFranjasHoy };
