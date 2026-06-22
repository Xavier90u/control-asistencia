const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Usuario = require("./src/models/Usuario");
const Asistencia = require("./src/models/Asistencia");
const Configuracion = require("./src/models/Configuracion");
const Horario = require("./src/models/Horario");
const Area = require("./src/models/Area");

require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/control-asistencia";

async function seed(force = false) {
  await mongoose.connect(MONGO_URI);

  const adminExists = await Usuario.findOne({ email: "admin@empresa.com" });
  if (adminExists && !force) {
    console.log("La BD ya tiene datos. Usa 'node seed.js --force' para regenerar.");
    await mongoose.disconnect();
    return { created: false };
  }

  if (force && adminExists) {
    await Asistencia.deleteMany({});
    await Usuario.deleteMany({});
    await Configuracion.deleteMany({});
    await Horario.deleteMany({});
    await Area.deleteMany({});
  }

  const adminPass = bcrypt.hashSync("admin123", 10);
  await Usuario.create({ nombre: "Administrador", email: "admin@empresa.com", password: adminPass, rol: "admin" });

  // Crear área por defecto
  const area = await Area.create({
    nombre: "General",
    franjasPorDia: {
      0: ["08:00", "11:00"],
      1: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
      2: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
      3: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
      4: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
      5: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
      6: ["08:00", "15:00"],
    },
  });

  const empleadosData = [
    { nombre: "Carlos López", email: "carlos@empresa.com", password: "123456", horaInicio: undefined, toleranciaMinutos: undefined, descuentoPorMinuto: undefined },
    { nombre: "María García", email: "maria@empresa.com", password: "123456", horaInicio: "08:30", toleranciaMinutos: 15, descuentoPorMinuto: undefined },
    { nombre: "Juan Pérez", email: "juan@empresa.com", password: "123456", horaInicio: undefined, toleranciaMinutos: 5, descuentoPorMinuto: 0.75 },
    { nombre: "Ana Torres", email: "ana@empresa.com", password: "123456", horaInicio: undefined, toleranciaMinutos: undefined, descuentoPorMinuto: undefined },
  ];

  for (const emp of empleadosData) {
    const pass = bcrypt.hashSync(emp.password, 10);
    await Usuario.create({ ...emp, password: pass, rol: "empleado", area: area._id });
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

  // Horarios personalizados para Juan Pérez
  const juan = empleados.find((e) => e.email === "juan@empresa.com");
  if (juan) {
    await Horario.insertMany([
      { empleado: juan._id, diaSemana: 1, franjas: ["10:00"] },   // Lunes solo 10am
      { empleado: juan._id, diaSemana: 2, franjas: ["08:00", "14:00", "18:00"] }, // Martes 8am, 2pm, 6pm
      { empleado: juan._id, diaSemana: 3, franjas: ["08:00", "10:00", "14:00", "16:00"] }, // Miércoles
      { empleado: juan._id, diaSemana: 4, franjas: ["08:00", "14:00", "18:00"] }, // Jueves 8am, 2pm, 6pm
      { empleado: juan._id, diaSemana: 5, franjas: ["14:00"] },  // Viernes solo 2pm
    ]);
  }

  const configDocs = await Configuracion.find().lean();
  const cfg = {};
  configDocs.forEach((c) => (cfg[c.clave] = c.valor));

  const hoy = new Date();

  for (let i = 14; i >= 0; i--) {
    for (const emp of empleados) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      const fechaStr = fecha.toISOString().split("T")[0];
      const dia = fecha.getDay();
      if (dia === 0 || dia === 6) continue; // skip weekends in seed data

      // Get franjas for this employee on this day
      const horarioDoc = await Horario.findOne({ empleado: emp._id, diaSemana: dia }).lean();
      let franjas = horarioDoc?.franjas || null;

      if (!franjas) {
        // Fallback: area franjas
        const areaDoc = await Area.findById(area._id).lean();
        franjas = areaDoc?.franjasPorDia?.get?.(String(dia)) || areaDoc?.franjasPorDia?.[dia] || [emp.horaInicio || cfg.hora_inicio_general || "08:00"].filter(Boolean);
      }

      if (!franjas || franjas.length === 0) continue;

      for (const franja of franjas) {
        const [hH, hM] = franja.split(":").map(Number);
        const minInicio = hH * 60 + hM;
        const tolerancia = emp.toleranciaMinutos ?? parseInt(cfg.tolerancia_general || "10");
        const minBase = minInicio + Math.floor(Math.random() * 20);
        const retrasoSim = Math.max(0, Math.floor(Math.random() * 20) - tolerancia);
        const horaMinutos = minBase + retrasoSim;
        const hora = String(Math.floor(horaMinutos / 60)).padStart(2, "0");
        const min = String(horaMinutos % 60).padStart(2, "0");
        const seg = String(Math.floor(Math.random() * 60)).padStart(2, "0");
        const minutosRetraso = Math.max(0, horaMinutos - (minInicio + tolerancia));

        try {
          await Asistencia.create({
            empleado: emp._id, fecha: fechaStr,
            horaMarcacion: `${hora}:${min}:${seg}`,
            horaEsperada: franja, minutosRetraso, franja,
          });
        } catch (e) {
          // ignore duplicate
        }
      }
    }
  }

  const mensaje = "Base de datos creada con datos demo (franjas por área).";
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
