const bcrypt = require("bcryptjs");
const Usuario = require("../models/Usuario");
const Asistencia = require("../models/Asistencia");
const Configuracion = require("../models/Configuracion");
const tz = require("../utils/timezone");

async function dashboard(req, res) {
  const totalEmpleados = await Usuario.countDocuments({
    rol: "empleado",
    activo: true,
  });
  const hoy = tz.todayStr();
  const asistenciasHoy = await Asistencia.countDocuments({ fecha: hoy });
  const tardanzasHoy = await Asistencia.countDocuments({
    fecha: hoy,
    minutosRetraso: { $gt: 0 },
  });
  const config = await getConfigMap();
  const tzCfg = await tz.getConfig();

  res.render("admin/dashboard", {
    totalEmpleados,
    asistenciasHoy,
    tardanzasHoy,
    config: { ...config, ...tzCfg },
  });
}

async function listEmpleados(req, res) {
  const docs = await Usuario.find({ rol: "empleado" })
    .select("nombre email activo horaInicio toleranciaMinutos descuentoPorMinuto createdAt")
    .sort({ activo: -1, nombre: 1 })
    .lean();
  const empleados = docs.map((e) => ({
    ...e,
    id: e._id.toString(),
    hora_inicio: e.horaInicio,
    tolerancia_minutos: e.toleranciaMinutos,
    descuento_por_minuto: e.descuentoPorMinuto,
  }));
  res.render("admin/empleados", { empleados });
}

async function createEmpleado(req, res) {
  const {
    nombre,
    email,
    password,
    hora_inicio,
    tolerancia_minutos,
    descuento_por_minuto,
  } = req.body;
  if (!nombre || !email || !password)
    return res.redirect("/admin/empleados?error=Completa todos los campos");

  const existing = await Usuario.findOne({ email });
  if (existing)
    return res.redirect("/admin/empleados?error=El email ya existe");

  const hashed = bcrypt.hashSync(password, 10);
  await Usuario.create({
    nombre,
    email,
    password: hashed,
    rol: "empleado",
    horaInicio: hora_inicio || undefined,
    toleranciaMinutos: tolerancia_minutos ? parseInt(tolerancia_minutos) : undefined,
    descuentoPorMinuto: descuento_por_minuto
      ? parseFloat(descuento_por_minuto)
      : undefined,
  });
  res.redirect("/admin/empleados?success=Empleado creado exitosamente");
}

async function editEmpleadoForm(req, res) {
  const doc = await Usuario.findOne({
    _id: req.params.id,
    rol: "empleado",
  }).lean();
  if (!doc)
    return res.redirect("/admin/empleados?error=Empleado no encontrado");
  const empleado = {
    ...doc,
    id: doc._id.toString(),
    hora_inicio: doc.horaInicio,
    tolerancia_minutos: doc.toleranciaMinutos,
    descuento_por_minuto: doc.descuentoPorMinuto,
  };
  res.render("admin/editar_empleado", { empleado });
}

async function updateEmpleado(req, res) {
  const {
    nombre,
    email,
    password,
    hora_inicio,
    tolerancia_minutos,
    descuento_por_minuto,
  } = req.body;
  const userId = req.params.id;

  const update = {
    nombre,
    email,
    horaInicio: hora_inicio || undefined,
    toleranciaMinutos: tolerancia_minutos
      ? parseInt(tolerancia_minutos)
      : undefined,
    descuentoPorMinuto: descuento_por_minuto
      ? parseFloat(descuento_por_minuto)
      : undefined,
  };

  if (password && password.trim()) {
    update.password = bcrypt.hashSync(password, 10);
  }

  const result = await Usuario.updateOne({ _id: userId, rol: "empleado" }, update);
  if (!result.matchedCount)
    return res.redirect("/admin/empleados?error=Empleado no encontrado");
  res.redirect("/admin/empleados?success=Empleado actualizado");
}

async function toggleEmpleado(req, res) {
  const user = await Usuario.findById(req.params.id);
  if (!user)
    return res.redirect("/admin/empleados?error=Empleado no encontrado");
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
  if (empleado_id && mongoose.Types.ObjectId.isValid(empleado_id))
    filter.empleado = new mongoose.Types.ObjectId(empleado_id);

  const registros = await Asistencia.find(filter)
    .populate("empleado", "nombre email horaInicio toleranciaMinutos descuentoPorMinuto")
    .sort({ fecha: -1, horaMarcacion: -1 })
    .lean();

  const config = await getConfigMap();
  const tzCfg = await tz.getConfig();
  const descuentoGeneral = parseFloat(config.descuento_por_minuto || "0.50");

  const registrosConDescuento = registros.map((r) => {
    const horaInicioEmp =
      r.empleado?.horaInicio || config.hora_inicio_general || "08:00";
    const toleranciaEmp =
      r.empleado?.toleranciaMinutos ??
      parseInt(config.tolerancia_general || "10");

    const minInicio = tz.horasToMinutes(horaInicioEmp);
    const minActual = tz.horasToMinutes(r.horaMarcacion);
    const minutosRetraso = Math.max(0, minActual - (minInicio + toleranciaEmp));

    const dtoXMinuto =
      r.empleado?.descuentoPorMinuto ?? descuentoGeneral;
    const descuentoTotal = minutosRetraso * dtoXMinuto;

    return {
      id: r._id,
      fecha: tz.formatFecha(r.fecha),
      hora_marcacion: tz.formatHora(r.horaMarcacion),
      hora_esperada: horaInicioEmp,
      minutos_retraso: minutosRetraso,
      empleado_nombre: r.empleado?.nombre || "—",
      empleado_email: r.empleado?.email || "—",
      descuento_x_minuto: dtoXMinuto,
      descuento_total: descuentoTotal,
    };
  });

  const empleados = (await Usuario.find({ rol: "empleado", activo: true })
    .select("nombre")
    .sort({ nombre: 1 })
    .lean()).map((e) => ({
      ...e,
      id: e._id.toString(),
    }));

  res.render("admin/tardanzas", {
    registros: registrosConDescuento,
    empleados,
    filtros: req.query,
    tzCfg,
  });
}

async function configView(req, res) {
  const config = await getConfigMap();
  const tzCfg = await tz.getConfig();
  res.render("admin/config", { config: { ...config, ...tzCfg } });
}

async function updateConfig(req, res) {
  const {
    hora_inicio_general,
    tolerancia_general,
    descuento_por_minuto,
    zona_horaria,
    formato_fecha,
    formato_hora,
  } = req.body;

  const updates = [
    { clave: "hora_inicio_general", valor: hora_inicio_general },
    { clave: "tolerancia_general", valor: tolerancia_general },
    { clave: "descuento_por_minuto", valor: descuento_por_minuto },
    { clave: "zona_horaria", valor: zona_horaria },
    { clave: "formato_fecha", valor: formato_fecha },
    { clave: "formato_hora", valor: formato_hora },
  ];

  for (const u of updates) {
    if (u.valor !== undefined && u.valor !== null && u.valor !== "")
      await Configuracion.updateOne(
        { clave: u.clave },
        { $set: { valor: u.valor } },
        { upsert: true }
      );
  }
  tz.getConfig.resetCache?.();
  res.redirect("/admin/config?success=Configuración actualizada");
}

async function seedData(req, res) {
  const { seed } = require("../../seed");
  const result = await seed(true);
  res.redirect(`/admin?success=${encodeURIComponent(result.message)}`);
}

async function getConfigMap() {
  const configs = await Configuracion.find().lean();
  const map = {};
  configs.forEach((c) => (map[c.clave] = c.valor));
  return map;
}

module.exports = {
  dashboard,
  listEmpleados,
  createEmpleado,
  editEmpleadoForm,
  updateEmpleado,
  toggleEmpleado,
  tardanzasView,
  configView,
  updateConfig,
  seedData,
};
