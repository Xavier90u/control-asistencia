const QRCode = require("qrcode");
const Usuario = require("../models/Usuario");
const Asistencia = require("../models/Asistencia");
const Notificacion = require("../models/Notificacion");
const Configuracion = require("../models/Configuracion");
const tz = require("../utils/timezone");
const horario = require("../utils/horario");
const { generarTokenQR, verificarTokenQR } = require("../utils/qr");

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

  const franjasHoy = await horario.getFranjasHoy(empleadoId);
  if (!franjasHoy.includes(franja)) {
    return res.redirect("/empleado?error=Esta franja no est\u00e1 disponible hoy");
  }

  const yaMarcada = await Asistencia.findOne({ empleado: empleadoId, fecha: fechaStr, franja });
  if (yaMarcada) {
    return res.redirect("/empleado?error=Ya marcaste esta franja hoy");
  }

  const minActual = tz.horasToMinutes(horaStr);
  const minFranja = tz.horasToMinutes(franja);
  if (minActual < minFranja - 10) {
    const esperar = tz.minutosToStr(minFranja - 10);
    return res.redirect(`/empleado?error=A\u00fan no puedes marcar para las ${franja}. Vuelve a las ${esperar}`);
  }

  const tolerancia = empleado.toleranciaMinutos ?? parseInt((await getConfigMap()).tolerancia_general || "10");
  const minutosRetraso = Math.max(0, minActual - (minFranja + tolerancia));

  await Asistencia.create({
    empleado: empleadoId, fecha: fechaStr, horaMarcacion: horaStr, horaEsperada: franja,
    minutosRetraso, franja, latitud: lat ? parseFloat(lat) : undefined, longitud: lng ? parseFloat(lng) : undefined,
  });

  const tipo = minutosRetraso > 0 ? "retraso" : "marcacion";
  const msg = minutosRetraso > 0
    ? `${empleado.nombre} marc\u00f3 las ${franja} con ${minutosRetraso} min de retraso`
    : `${empleado.nombre} marc\u00f3 las ${franja} a tiempo`;

  await Notificacion.create({
    empleado: empleadoId, tipo, mensaje: msg, fecha: fechaStr, hora: horaStr,
  });

  const io = req.app.get("io");
  if (io) {
    io.to("admin-room").emit("nueva-notificacion", {
      empleado: empleado.nombre,
      tipo,
      mensaje: msg,
      fecha: fechaStr,
      hora: horaStr,
    });
  }

  let redirectMsg;
  if (minutosRetraso > 0) {
    redirectMsg = `Franja ${franja} registrada con ${minutosRetraso} min de retraso`;
  } else {
    redirectMsg = `Franja ${franja} registrada a tiempo`;
  }

  res.redirect(`/empleado?success=${encodeURIComponent(redirectMsg)}`);
}

async function qrView(req, res) {
  const mongoose = require("mongoose");
  const userId = new mongoose.Types.ObjectId(req.session.user.id);
  const empleado = await Usuario.findById(userId).lean();

  const token = generarTokenQR(userId.toString());
  const qrDataUrl = await QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: { dark: "#1e293b", light: "#ffffff" },
  });

  res.render("empleado/qr", { empleado, qrDataUrl, token });
}

async function marcarQRForm(req, res) {
  const { token } = req.query;
  if (!token) return res.redirect("/login?error=Token QR inv\u00e1lido");

  const payload = verificarTokenQR(token);
  if (!payload) return res.redirect("/login?error=Token QR expirado o inv\u00e1lido");

  const empleadoId = payload.emp;
  const empleado = await Usuario.findById(empleadoId).lean();
  if (!empleado) return res.redirect("/login?error=Empleado no encontrado");

  const fechaStr = tz.todayStr();
  const config = await getConfigMap();
  const tzCfg = await tz.getConfig();

  const franjasHoy = await horario.getFranjasHoy(empleadoId);
  const marcacionesHoy = await Asistencia.find({ empleado: empleadoId, fecha: fechaStr }).lean();
  const marcadas = new Set(marcacionesHoy.map((m) => m.franja));

  const now = tz.now();
  const minActual = tz.horasToMinutes(now.format("HH:mm"));

  const franjasConEstado = franjasHoy.map((f) => {
    const minFranja = tz.horasToMinutes(f);
    const disponible = minActual >= minFranja - 10;
    const marcada = marcadas.has(f);
    return { franja: f, marcada, disponible };
  });

  const todosMarcados = franjasConEstado.every((f) => f.marcada);

  res.render("empleado/marcar-qr", {
    empleado,
    franjas: franjasConEstado,
    todosMarcados,
    token,
    config: { ...config, ...tzCfg },
  });
}

async function marcarPorQR(req, res) {
  const { token, franja } = req.body;
  if (!token || !franja) return res.redirect("/login?error=Faltan datos");

  const payload = verificarTokenQR(token);
  if (!payload) return res.redirect("/login?error=Token QR expirado o inv\u00e1lido");

  const empleadoId = payload.emp;
  const empleado = await Usuario.findById(empleadoId).lean();
  if (!empleado) return res.redirect("/login?error=Empleado no encontrado");

  const fechaStr = tz.todayStr();
  const horaStr = tz.timeStr();

  const franjasHoy = await horario.getFranjasHoy(empleadoId);
  if (!franjasHoy.includes(franja)) {
    return res.redirect(`/empleado/marcar-qr?token=${token}&error=Franja no disponible`);
  }

  const yaMarcada = await Asistencia.findOne({ empleado: empleadoId, fecha: fechaStr, franja });
  if (yaMarcada) {
    return res.redirect(`/empleado/marcar-qr?token=${token}&error=Ya marcaste esta franja`);
  }

  const minActual = tz.horasToMinutes(horaStr);
  const minFranja = tz.horasToMinutes(franja);
  if (minActual < minFranja - 10) {
    const esperar = tz.minutosToStr(minFranja - 10);
    return res.redirect(`/empleado/marcar-qr?token=${token}&error=Vuelve a las ${esperar}`);
  }

  const tolerancia = empleado.toleranciaMinutos ?? parseInt((await getConfigMap()).tolerancia_general || "10");
  const minutosRetraso = Math.max(0, minActual - (minFranja + tolerancia));

  await Asistencia.create({
    empleado: empleadoId, fecha: fechaStr, horaMarcacion: horaStr, horaEsperada: franja,
    minutosRetraso, franja,
  });

  const tipo = minutosRetraso > 0 ? "retraso" : "marcacion";
  const msg = minutosRetraso > 0
    ? `${empleado.nombre} marc\u00f3 las ${franja} con ${minutosRetraso} min de retraso`
    : `${empleado.nombre} marc\u00f3 las ${franja} a tiempo`;

  await Notificacion.create({
    empleado: empleadoId, tipo, mensaje: msg, fecha: fechaStr, hora: horaStr,
  });

  const io = req.app.get("io");
  if (io) {
    io.to("admin-room").emit("nueva-notificacion", {
      empleado: empleado.nombre, tipo, mensaje: msg, fecha: fechaStr, hora: horaStr,
    });
  }

  let resultMsg;
  if (minutosRetraso > 0) {
    resultMsg = `Marcado con ${minutosRetraso} min de retraso`;
  } else {
    resultMsg = "Marcado a tiempo";
  }

  res.render("empleado/marcar-qr-exito", { empleado, franja, resultMsg, minutosRetraso });
}

async function historialView(req, res) {
  const mongoose = require("mongoose");
  const userId = new mongoose.Types.ObjectId(req.session.user.id);

  const registros = await Asistencia.find({ empleado: userId })
    .sort({ fecha: -1, horaMarcacion: -1 })
    .lean();

  const resumen = await Asistencia.aggregate([
    { $match: { empleado: userId } },
    { $group: { _id: null, total_dias: { $sum: 1 }, tardanzas: { $sum: { $cond: [{ $gt: ["$minutosRetraso", 0] }, 1, 0] } }, total_minutos_retraso: { $sum: "$minutosRetraso" } } },
  ]);

  const registrosFormateados = registros.map((r) => {
    const d = new Date(r.fecha + "T12:00:00");
    const diaSemana = d.getDay();
    const diff = d.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const lunes = new Date(d);
    lunes.setDate(diff);
    const viernes = new Date(lunes);
    viernes.setDate(lunes.getDate() + 4);
    const semanaKey = lunes.toISOString().split("T")[0];
    const semanaLabel = `${lunes.getDate()}/${lunes.getMonth()+1} - ${viernes.getDate()}/${viernes.getMonth()+1}, ${viernes.getFullYear()}`;
    const diaLabel = ["Dom","Lun","Mar","Mi\u00e9","Jue","Vie","S\u00e1b"][diaSemana];

    return {
      ...r,
      fecha: tz.formatFecha(r.fecha),
      horaMarcacion: tz.formatHora(r.horaMarcacion),
      horaEsperada: r.horaEsperada,
      semanaKey,
      semanaLabel,
      diaLabel,
      diaNombre: ["Domingo","Lunes","Martes","Mi\u00e9rcoles","Jueves","Viernes","S\u00e1bado"][diaSemana],
    };
  });

  const semanas = {};
  registrosFormateados.forEach((r) => {
    if (!semanas[r.semanaKey]) semanas[r.semanaKey] = { label: r.semanaLabel, registros: [] };
    semanas[r.semanaKey].registros.push(r);
  });

  const semanasArray = Object.entries(semanas).map(([key, val]) => ({
    key,
    label: val.label,
    registros: val.registros,
    totalTardanzas: val.registros.filter(r => r.minutosRetraso > 0).length,
    totalRegistros: val.registros.length,
  }));

  const page = 1;
  const porPagina = 4;
  const totalPaginas = Math.ceil(semanasArray.length / porPagina);
  const pag = parseInt(req.query.page) || 1;
  const semanasPagina = semanasArray.slice((pag - 1) * porPagina, pag * porPagina);

  res.render("empleado/historial", {
    semanas: semanasPagina,
    resumen: resumen[0] || { total_dias: 0, tardanzas: 0, total_minutos_retraso: 0 },
    page: pag, totalPages: totalPaginas,
    registrosFormateados,
  });
}

async function getConfigMap() {
  const configs = await Configuracion.find().lean();
  const map = {};
  configs.forEach((c) => (map[c.clave] = c.valor));
  return map;
}

module.exports = { marcacionView, marcar, qrView, marcarQRForm, marcarPorQR, historialView };
