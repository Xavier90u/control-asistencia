const bcrypt = require("bcryptjs");
const Usuario = require("../models/Usuario");
const Asistencia = require("../models/Asistencia");
const Notificacion = require("../models/Notificacion");
const Configuracion = require("../models/Configuracion");
const Horario = require("../models/Horario");
const Area = require("../models/Area");
const tz = require("../utils/timezone");
const horario = require("../utils/horario");

async function dashboard(req, res) {
  const totalEmpleados = await Usuario.countDocuments({ rol: "empleado", activo: true });
  const hoy = tz.todayStr();
  const asistenciasHoy = await Asistencia.countDocuments({ fecha: hoy });
  const tardanzasHoy = await Asistencia.countDocuments({ fecha: hoy, minutosRetraso: { $gt: 0 } });
  const config = await getConfigMap();
  const tzCfg = await tz.getConfig();

  const notificaciones = await Notificacion.find({ leida: false })
    .populate("empleado", "nombre")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const noLeidas = await Notificacion.countDocuments({ leida: false });

  res.render("admin/dashboard", {
    totalEmpleados, asistenciasHoy, tardanzasHoy,
    config: { ...config, ...tzCfg },
    notificaciones, noLeidas,
  });
}

async function notificacionesAPI(req, res) {
  const notificaciones = await Notificacion.find()
    .populate("empleado", "nombre")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const noLeidas = await Notificacion.countDocuments({ leida: false });
  res.json({ notificaciones, noLeidas });
}

async function marcarLeidas(req, res) {
  await Notificacion.updateMany({ leida: false }, { leida: true });
  res.json({ ok: true });
}

async function listEmpleados(req, res) {
  const porPagina = 10;
  const pag = parseInt(req.query.page) || 1;
  const total = await Usuario.countDocuments({ rol: "empleado" });
  const totalPaginas = Math.ceil(total / porPagina);
  const docs = await Usuario.find({ rol: "empleado" })
    .populate("area", "nombre")
    .select("nombre email activo area horaInicio createdAt")
    .sort({ activo: -1, nombre: 1 })
    .skip((pag - 1) * porPagina)
    .limit(porPagina)
    .lean();
  const empleados = docs.map((e) => ({ ...e, id: e._id.toString(), area_nombre: e.area?.nombre || "—" }));
  const areas = await Area.find().sort({ nombre: 1 }).lean();
  res.render("admin/empleados", { empleados, areas, page: pag, totalPaginas, total });
}

async function createEmpleado(req, res) {
  const { nombre, email, password, area, hora_inicio, tolerancia_minutos, descuento_por_minuto, telefono } = req.body;
  if (!nombre || !email || !password) return res.redirect("/admin/empleados?error=Completa todos los campos");
  if (await Usuario.findOne({ email })) return res.redirect("/admin/empleados?error=El email ya existe");
  const hashed = bcrypt.hashSync(password, 10);
  await Usuario.create({
    nombre, email, password: hashed, rol: "empleado",
    area: area || undefined,
    horaInicio: hora_inicio || undefined,
    toleranciaMinutos: tolerancia_minutos ? parseInt(tolerancia_minutos) : undefined,
    descuentoPorMinuto: descuento_por_minuto ? parseFloat(descuento_por_minuto) : undefined,
    telefono: telefono || undefined,
  });
  res.redirect("/admin/empleados?success=Empleado creado exitosamente");
}

async function editEmpleadoForm(req, res) {
  const doc = await Usuario.findOne({ _id: req.params.id, rol: "empleado" }).lean();
  if (!doc) return res.redirect("/admin/empleados?error=Empleado no encontrado");
  const empleado = { ...doc, id: doc._id.toString() };
  const areas = await Area.find().sort({ nombre: 1 }).lean();
  res.render("admin/editar_empleado", { empleado, areas });
}

async function updateEmpleado(req, res) {
  const { nombre, email, password, area, hora_inicio, tolerancia_minutos, descuento_por_minuto, telefono } = req.body;
  const update = {
    nombre, email,
    area: area || undefined,
    horaInicio: hora_inicio || undefined,
    toleranciaMinutos: tolerancia_minutos ? parseInt(tolerancia_minutos) : undefined,
    descuentoPorMinuto: descuento_por_minuto ? parseFloat(descuento_por_minuto) : undefined,
    telefono: telefono || undefined,
  };
  if (password && password.trim()) update.password = bcrypt.hashSync(password, 10);
  const result = await Usuario.updateOne({ _id: req.params.id, rol: "empleado" }, update);
  if (!result.matchedCount) return res.redirect("/admin/empleados?error=Empleado no encontrado");
  res.redirect("/admin/empleados?success=Empleado actualizado");
}

async function toggleEmpleado(req, res) {
  const user = await Usuario.findById(req.params.id);
  if (!user) return res.redirect("/admin/empleados?error=Empleado no encontrado");
  user.activo = !user.activo;
  await user.save();
  res.redirect("/admin/empleados?success=Estado actualizado");
}

async function tardanzasView(req, res) {
  const { fecha_desde, fecha_hasta, empleado_id } = req.query;
  const filter = {};
  const mongoose = require("mongoose");
  if (fecha_desde) filter.fecha = { $gte: fecha_desde };
  if (fecha_hasta) filter.fecha = { ...filter.fecha, $lte: fecha_hasta };
  if (empleado_id && mongoose.Types.ObjectId.isValid(empleado_id)) filter.empleado = new mongoose.Types.ObjectId(empleado_id);
  const registros = await Asistencia.find(filter)
    .populate("empleado", "nombre email horaInicio toleranciaMinutos descuentoPorMinuto")
    .sort({ fecha: -1, horaMarcacion: -1 })
    .lean();
  const config = await getConfigMap();
  const tzCfg = await tz.getConfig();
  const descuentoGeneral = parseFloat(config.descuento_por_minuto || "0.50");
  const registrosConDescuento = registros.map((r) => {
    const horaInicioEmp = r.horaEsperada || r.empleado?.horaInicio || config.hora_inicio_general || "08:00";
    const toleranciaEmp = r.empleado?.toleranciaMinutos ?? parseInt(config.tolerancia_general || "10");
    const minInicio = tz.horasToMinutes(horaInicioEmp);
    const minActual = tz.horasToMinutes(r.horaMarcacion);
    const minutosRetraso = Math.max(0, minActual - (minInicio + toleranciaEmp));
    const dtoXMinuto = r.empleado?.descuentoPorMinuto ?? descuentoGeneral;
    const d = new Date(r.fecha + "T12:00:00");
    const diaSemana = d.getDay();
    const diff = d.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const lunes = new Date(d);
    lunes.setDate(diff);
    const viernes = new Date(lunes);
    viernes.setDate(lunes.getDate() + 4);
    const semanaKey = lunes.toISOString().split("T")[0];
    const semanaLabel = `${lunes.getDate()}/${lunes.getMonth()+1} - ${viernes.getDate()}/${viernes.getMonth()+1}, ${viernes.getFullYear()}`;
    const diaLabel = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][diaSemana];
    return {
      id: r._id, fecha: tz.formatFecha(r.fecha), fechaRaw: r.fecha,
      hora_marcacion: tz.formatHora(r.horaMarcacion), hora_esperada: horaInicioEmp,
      minutos_retraso: minutosRetraso, empleado_nombre: r.empleado?.nombre || "—",
      empleado_email: r.empleado?.email || "—",
      descuento_x_minuto: dtoXMinuto, descuento_total: minutosRetraso * dtoXMinuto,
      turno: (r.turnoIndex ?? 0) + 1, franja: r.franja || "",
      semanaKey, semanaLabel, diaLabel,
    };
  });

  const semanas = {};
  registrosConDescuento.forEach((r) => {
    if (!semanas[r.semanaKey]) semanas[r.semanaKey] = { label: r.semanaLabel, registros: [] };
    semanas[r.semanaKey].registros.push(r);
  });
  const semanasArray = Object.entries(semanas).map(([key, val]) => ({
    key, label: val.label, registros: val.registros,
    totalDescuento: val.registros.reduce((s, r) => s + Math.max(0, parseFloat(r.descuento_total || 0)), 0),
    totalTardanzas: val.registros.filter(r => r.minutos_retraso > 0).length,
  }));

  const porPagina = 4;
  const pag = parseInt(req.query.page) || 1;
  const totalPaginas = Math.ceil(semanasArray.length / porPagina);
  const semanasPagina = semanasArray.slice((pag - 1) * porPagina, pag * porPagina);

  const empleados = (await Usuario.find({ rol: "empleado", activo: true }).select("nombre").sort({ nombre: 1 }).lean()).map((e) => ({ ...e, id: e._id.toString() }));
  res.render("admin/tardanzas", { semanas: semanasPagina, registros: registrosConDescuento, empleados, filtros: req.query, tzCfg, page: pag, totalPaginas });
}

async function configView(req, res) {
  const config = await getConfigMap();
  const tzCfg = await tz.getConfig();
  res.render("admin/config", { config: { ...config, ...tzCfg } });
}

async function updateConfig(req, res) {
  const { hora_inicio_general, tolerancia_general, descuento_por_minuto, zona_horaria, formato_fecha, formato_hora, admin_telefono } = req.body;
  const updates = [
    { clave: "hora_inicio_general", valor: hora_inicio_general },
    { clave: "tolerancia_general", valor: tolerancia_general },
    { clave: "descuento_por_minuto", valor: descuento_por_minuto },
    { clave: "zona_horaria", valor: zona_horaria },
    { clave: "formato_fecha", valor: formato_fecha },
    { clave: "formato_hora", valor: formato_hora },
    { clave: "admin_telefono", valor: admin_telefono },
  ];
  for (const u of updates) {
    if (u.valor !== undefined && u.valor !== null && u.valor !== "")
      await Configuracion.updateOne({ clave: u.clave }, { $set: { valor: u.valor } }, { upsert: true });
  }
  tz.getConfig.resetCache?.();
  res.redirect("/admin/config?success=Configuración actualizada");
}

async function seedData(req, res) {
  const { seed } = require("../../seed");
  const result = await seed(true);
  res.redirect(`/admin?success=${encodeURIComponent(result.message)}`);
}

// --- Areas ---

async function areasView(req, res) {
  const areas = await Area.find().sort({ nombre: 1 }).lean();
  res.render("admin/areas", { areas });
}

async function createArea(req, res) {
  const { nombre } = req.body;
  if (!nombre) return res.redirect("/admin/areas?error=Nombre requerido");
  await Area.create({ nombre });
  res.redirect("/admin/areas?success=Área creada");
}

async function editAreaForm(req, res) {
  const area = await Area.findById(req.params.id).lean();
  if (!area) return res.redirect("/admin/areas?error=Área no encontrada");
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const horas = ["08:00", "10:00", "11:00", "14:00", "15:00", "16:00", "18:00", "20:00"];
  res.render("admin/editar_area", { area, dias, horas });
}

async function updateArea(req, res) {
  const { nombre, franjas } = req.body;
  if (!nombre) return res.redirect(`/admin/areas/${req.params.id}/editar?error=Nombre requerido`);
  const franjasPorDia = {};
  for (let d = 0; d <= 6; d++) {
    franjasPorDia[d] = franjas?.[d] || [];
  }
  await Area.updateOne({ _id: req.params.id }, { $set: { nombre, franjasPorDia } });
  res.redirect("/admin/areas?success=Área actualizada");
}

async function deleteArea(req, res) {
  const id = req.params.id;
  const usersInArea = await Usuario.countDocuments({ area: id });
  if (usersInArea > 0) return res.redirect("/admin/areas?error=No se puede eliminar: hay docentes asignados a esta área");
  await Area.deleteOne({ _id: id });
  res.redirect("/admin/areas?success=Área eliminada");
}

// --- Horarios ---

async function horariosView(req, res) {
  const empleadoId = req.query.empleado_id;
  const empleados = await Usuario.find({ rol: "empleado", activo: true })
    .select("nombre area")
    .populate("area", "nombre franjasPorDia")
    .sort({ nombre: 1 })
    .lean();
  let horarioDocs = [];
  let empleadoSeleccionado = null;
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  if (empleadoId) {
    empleadoSeleccionado = empleados.find((e) => e._id.toString() === empleadoId);
    horarioDocs = await Horario.find({ empleado: empleadoId }).sort({ diaSemana: 1 }).lean();
  }

  res.render("admin/horarios", { empleados, empleadoSeleccionado, horarioDocs, dias, empleadoId: empleadoId || "" });
}

async function updateHorarios(req, res) {
  const { empleado_id, franjas } = req.body;
  const mongoose = require("mongoose");
  const empId = new mongoose.Types.ObjectId(empleado_id);
  const empleado = await Usuario.findById(empId);
  if (!empleado) return res.redirect("/admin/horarios?error=Empleado no encontrado");

  for (let d = 0; d <= 6; d++) {
    const franjasDia = franjas?.[d] || [];
    if (franjasDia.length > 0) {
      let franjasArray = franjasDia;
      if (!Array.isArray(franjasDia)) {
        franjasArray = [franjasDia];
      }
      await Horario.updateOne(
        { empleado: empId, diaSemana: d },
        { $set: { franjas: franjasArray } },
        { upsert: true }
      );
    } else {
      await Horario.deleteOne({ empleado: empId, diaSemana: d });
    }
  }

  res.redirect(`/admin/horarios?empleado_id=${empleado_id}&success=Horarios actualizados`);
}

async function getConfigMap() {
  const configs = await Configuracion.find().lean();
  const map = {};
  configs.forEach((c) => (map[c.clave] = c.valor));
  return map;
}

module.exports = {
  dashboard, listEmpleados, createEmpleado, editEmpleadoForm, updateEmpleado, toggleEmpleado,
  tardanzasView, configView, updateConfig, seedData,
  areasView, createArea, editAreaForm, updateArea, deleteArea,
  horariosView, updateHorarios,
  notificacionesAPI, marcarLeidas,
};
