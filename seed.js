const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Usuario = require("./src/models/Usuario");
const Asistencia = require("./src/models/Asistencia");
const Configuracion = require("./src/models/Configuracion");

require("dotenv").config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/control-asistencia";

async function seed(force = false) {
  await mongoose.connect(MONGO_URI);

  const adminExists = await Usuario.findOne({ email: "admin@empresa.com" });
  if (adminExists && !force) {
    console.log(
      "La BD ya tiene datos. Usa 'node seed.js --force' para regenerar."
    );
    await mongoose.disconnect();
    return { created: false };
  }

  if (force && adminExists) {
    await Asistencia.deleteMany({});
    await Usuario.deleteMany({});
    await Configuracion.deleteMany({});
  }

  const adminPass = bcrypt.hashSync("admin123", 10);
  await Usuario.create({
    nombre: "Administrador",
    email: "admin@empresa.com",
    password: adminPass,
    rol: "admin",
  });

  const empleadosData = [
    {
      nombre: "Carlos López",
      email: "carlos@empresa.com",
      password: "123456",
      horaInicio: undefined,
      toleranciaMinutos: undefined,
      descuentoPorMinuto: undefined,
    },
    {
      nombre: "María García",
      email: "maria@empresa.com",
      password: "123456",
      horaInicio: "08:30",
      toleranciaMinutos: 15,
      descuentoPorMinuto: undefined,
    },
    {
      nombre: "Juan Pérez",
      email: "juan@empresa.com",
      password: "123456",
      horaInicio: undefined,
      toleranciaMinutos: 5,
      descuentoPorMinuto: 0.75,
    },
    {
      nombre: "Ana Torres",
      email: "ana@empresa.com",
      password: "123456",
      horaInicio: undefined,
      toleranciaMinutos: undefined,
      descuentoPorMinuto: undefined,
    },
  ];

  for (const emp of empleadosData) {
    const pass = bcrypt.hashSync(emp.password, 10);
    await Usuario.create({ ...emp, password: pass, rol: "empleado" });
  }

  const defaultConfig = [
    { clave: "hora_inicio_general", valor: "08:00" },
    { clave: "tolerancia_general", valor: "10" },
    { clave: "descuento_por_minuto", valor: "0.50" },
    { clave: "zona_horaria", valor: "America/Lima" },
    { clave: "formato_fecha", valor: "YYYY-MM-DD" },
    { clave: "formato_hora", valor: "HH:mm:ss" },
  ];
  await Configuracion.insertMany(defaultConfig);

  const empleados = await Usuario.find({ rol: "empleado" }).lean();
  const configDocs = await Configuracion.find().lean();
  const cfg = {};
  configDocs.forEach((c) => (cfg[c.clave] = c.valor));

  const hoy = new Date();

  for (let i = 14; i >= 0; i--) {
    for (const emp of empleados) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      if (fecha.getDay() === 0 || fecha.getDay() === 6) continue;

      const fechaStr = fecha.toISOString().split("T")[0];
      const horaInicioEmp = emp.horaInicio || cfg.hora_inicio_general || "08:00";
      const toleranciaEmp = emp.toleranciaMinutos ?? parseInt(cfg.tolerancia_general || "10");

      const [hH, hM] = horaInicioEmp.split(":").map(Number);
      const minInicio = hH * 60 + hM;
      const minBase = minInicio + Math.floor(Math.random() * 20);
      const retraso = Math.max(0, Math.floor(Math.random() * 25) - toleranciaEmp);

      const horaMinutos = minBase + retraso;
      const hora = String(Math.floor(horaMinutos / 60)).padStart(2, "0");
      const min = String(horaMinutos % 60).padStart(2, "0");
      const seg = String(Math.floor(Math.random() * 60)).padStart(2, "0");
      const minutosRetraso = Math.max(0, horaMinutos - (minInicio + toleranciaEmp));

      try {
        await Asistencia.create({
          empleado: emp._id,
          fecha: fechaStr,
          horaMarcacion: `${hora}:${min}:${seg}`,
          horaEsperada: horaInicioEmp,
          minutosRetraso,
        });
      } catch (e) {
        // ignore duplicate
      }
    }
  }

  const mensaje = "Base de datos creada con datos demo (14 días).";
  console.log("✅ " + mensaje);

  console.log("");
  console.log("Credenciales:");
  console.log("  Admin:     admin@empresa.com / admin123");
  console.log("  Empleados: carlos@empresa.com / 123456");
  console.log("             maria@empresa.com  / 123456");
  console.log("             juan@empresa.com   / 123456");
  console.log("             ana@empresa.com    / 123456");

  await mongoose.disconnect();
  return { created: true, message: mensaje };
}

const force = process.argv.includes("--force");
seed(force).catch(console.error);

module.exports = { seed };
