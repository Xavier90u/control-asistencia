const moment = require("moment-timezone");
const Configuracion = require("../models/Configuracion");

let cache = {
  zona: "America/Lima",
  fmtFecha: "YYYY-MM-DD",
  fmtHora: "HH:mm:ss",
  ts: 0,
};

async function getConfig() {
  const now = Date.now();
  if (now - cache.ts < 30000) return cache;
  const docs = await Configuracion.find({
    clave: { $in: ["zona_horaria", "formato_fecha", "formato_hora"] },
  }).lean();
  const map = {};
  docs.forEach((d) => (map[d.clave] = d.valor));
  cache = {
    zona: map.zona_horaria || "America/Lima",
    fmtFecha: map.formato_fecha || "YYYY-MM-DD",
    fmtHora: map.formato_hora || "HH:mm:ss",
    ts: now,
  };
  return cache;
}

function now() {
  return moment().tz(cache.zona);
}

function todayStr() {
  return now().format("YYYY-MM-DD");
}

function timeStr() {
  return now().format("HH:mm:ss");
}

function formatFecha(fecha) {
  if (!fecha) return "";
  return moment(fecha).tz(cache.zona).format(cache.fmtFecha);
}

function formatHora(hora) {
  if (!hora) return "";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
    const parts = hora.split(":");
    const m = now().clone();
    m.hours(parseInt(parts[0]));
    m.minutes(parseInt(parts[1]));
    if (parts[2]) m.seconds(parseInt(parts[2]));
    return m.format(cache.fmtHora);
  }
  return moment(hora).tz(cache.zona).format(cache.fmtHora);
}

function horasToMinutes(hora) {
  if (!hora) return 0;
  const p = hora.split(":");
  return parseInt(p[0]) * 60 + parseInt(p[1] || 0);
}

function minutosToStr(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function initDefaults() {
  const defaults = [
    { clave: "zona_horaria", valor: "America/Lima" },
    { clave: "formato_fecha", valor: "YYYY-MM-DD" },
    { clave: "formato_hora", valor: "HH:mm:ss" },
  ];
  for (const d of defaults) {
    const exists = await Configuracion.findOne({ clave: d.clave });
    if (!exists)
      await Configuracion.create(d);
  }
}

module.exports = {
  getConfig,
  now,
  todayStr,
  timeStr,
  formatFecha,
  formatHora,
  horasToMinutes,
  minutosToStr,
  initDefaults,
};
