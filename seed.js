const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Usuario = require("./src/models/Usuario");
const Asistencia = require("./src/models/Asistencia");
const Configuracion = require("./src/models/Configuracion");
const Horario = require("./src/models/Horario");
const Area = require("./src/models/Area");

require("dotenv").config();
const { patchDns } = require("./src/utils/dns-patch");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/control-asistencia";

async function seed(force = false) {
  if (MONGO_URI.includes("mongodb+srv")) patchDns();
  await mongoose.connect(MONGO_URI);

  const adminExists = await Usuario.findOne({ email: "admin@empresa.com" });
  if (adminExists && !force) {
    console.log("La BD ya tiene datos. Usa 'node seed.js --force' para regenerar.");
    await mongoose.disconnect();
    return { created: false, message: "La BD ya tiene datos." };
  }

  // Always clean all data when --force
  await Asistencia.deleteMany({});
  await Usuario.deleteMany({});
  await Configuracion.deleteMany({});
  await Horario.deleteMany({});
  await Area.deleteMany({});

  const adminPass = bcrypt.hashSync("admin123", 10);
  await Usuario.create({ nombre: "Administrador General", email: "admin@empresa.com", password: adminPass, rol: "admin" });

  const areasData = [
    {
      nombre: "Ingeniería de Sistemas",
      franjasPorDia: {
        0: ["08:00", "11:00"],
        1: ["07:00", "09:00", "11:00", "14:00", "16:00"],
        2: ["07:00", "09:00", "11:00", "14:00", "16:00"],
        3: ["07:00", "09:00", "11:00", "14:00", "16:00"],
        4: ["07:00", "09:00", "11:00", "14:00", "16:00"],
        5: ["07:00", "09:00", "11:00", "14:00", "16:00"],
        6: ["08:00"],
      },
    },
    {
      nombre: "Ingeniería Industrial",
      franjasPorDia: {
        0: [],
        1: ["08:00", "10:00", "14:00", "16:00", "18:00"],
        2: ["08:00", "10:00", "14:00", "16:00", "18:00"],
        3: ["08:00", "10:00", "14:00", "16:00", "18:00"],
        4: ["08:00", "10:00", "14:00", "16:00", "18:00"],
        5: ["08:00", "10:00", "14:00", "16:00", "18:00"],
        6: ["09:00"],
      },
    },
    {
      nombre: "Ciencias de la Computación",
      franjasPorDia: {
        0: ["10:00"],
        1: ["08:00", "10:00", "12:00", "15:00", "17:00"],
        2: ["08:00", "10:00", "12:00", "15:00", "17:00"],
        3: ["08:00", "10:00", "12:00", "15:00", "17:00"],
        4: ["08:00", "10:00", "12:00", "15:00", "17:00"],
        5: ["08:00", "10:00", "12:00", "15:00", "17:00"],
        6: [],
      },
    },
    {
      nombre: "Administración de Empresas",
      franjasPorDia: {
        0: [],
        1: ["07:00", "09:00", "13:00", "15:00", "19:00"],
        2: ["07:00", "09:00", "13:00", "15:00", "19:00"],
        3: ["07:00", "09:00", "13:00", "15:00", "19:00"],
        4: ["07:00", "09:00", "13:00", "15:00", "19:00"],
        5: ["07:00", "09:00", "13:00", "15:00", "19:00"],
        6: ["08:00", "10:00"],
      },
    },
    {
      nombre: "Contabilidad",
      franjasPorDia: {
        0: [],
        1: ["08:00", "11:00", "14:00"],
        2: ["08:00", "11:00", "14:00"],
        3: ["08:00", "11:00", "14:00"],
        4: ["08:00", "11:00", "14:00"],
        5: ["08:00", "11:00", "14:00"],
        6: [],
      },
    },
  ];

  const areas = [];
  for (const ad of areasData) {
    areas.push(await Area.create(ad));
  }

  const empleadosData = [
    { nombre: "Carlos López Mendoza", email: "carlos@empresa.com", password: "123456", area: 0, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "María García Ruiz", email: "maria@empresa.com", password: "123456", area: 0, horaInicio: "09:00", toleranciaMinutos: 15, descuentoPorMinuto: 0.75 },
    { nombre: "Juan Pérez Torres", email: "juan@empresa.com", password: "123456", area: 1, toleranciaMinutos: 5, descuentoPorMinuto: 1.00 },
    { nombre: "Ana Torres Vega", email: "ana@empresa.com", password: "123456", area: 1, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Pedro Sánchez Díaz", email: "pedro@empresa.com", password: "123456", area: 2, horaInicio: "08:00", toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Laura Morales Ríos", email: "laura@empresa.com", password: "123456", area: 2, toleranciaMinutos: 8, descuentoPorMinuto: 0.60 },
    { nombre: "Roberto Díaz Vargas", email: "roberto@empresa.com", password: "123456", area: 3, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Carmen Vargas Luna", email: "carmen@empresa.com", password: "123456", area: 3, horaInicio: "09:00", toleranciaMinutos: 12, descuentoPorMinuto: 0.55 },
    { nombre: "Fernando López Campos", email: "fernando@empresa.com", password: "123456", area: 4, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Isabella Martínez Solís", email: "isabella@empresa.com", password: "123456", area: 0, toleranciaMinutos: 7, descuentoPorMinuto: 0.80 },
    { nombre: "Diego Ramírez Ortega", email: "diego@empresa.com", password: "123456", area: 1, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Sofía Herrera Cruz", email: "sofia@empresa.com", password: "123456", area: 2, toleranciaMinutos: 5, descuentoPorMinuto: 1.20 },
    { nombre: "Miguel Ángel Rojas", email: "miguel@empresa.com", password: "123456", area: 3, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Valentina Castro Paredes", email: "valentina@empresa.com", password: "123456", area: 4, horaInicio: "08:30", toleranciaMinutos: 15, descuentoPorMinuto: 0.45 },
    { nombre: "Andrés Gutiérrez Flores", email: "andres@empresa.com", password: "123456", area: 0, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Camila Flores Quispe", email: "camila@empresa.com", password: "123456", area: 1, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Luis Hernández Silva", email: "luis@empresa.com", password: "123456", area: 2, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Gabriela Peña Montes", email: "gabriela@empresa.com", password: "123456", area: 3, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Ricardo Zamora Delgado", email: "ricardo@empresa.com", password: "123456", area: 4, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
    { nombre: "Daniela Álvarez Reyes", email: "daniela@empresa.com", password: "123456", area: 0, toleranciaMinutos: 10, descuentoPorMinuto: 0.50 },
  ];

  const empleadosCreados = [];
  for (const emp of empleadosData) {
    const pass = bcrypt.hashSync(emp.password, 10);
    const doc = await Usuario.create({
      nombre: emp.nombre,
      email: emp.email,
      password: pass,
      rol: "empleado",
      area: areas[emp.area]._id,
      horaInicio: emp.horaInicio || undefined,
      toleranciaMinutos: emp.toleranciaMinutos,
      descuentoPorMinuto: emp.descuentoPorMinuto,
    });
    empleadosCreados.push(doc);
  }

  const defaultConfig = [
    { clave: "hora_inicio_general", valor: "08:00" },
    { clave: "tolerancia_general", valor: "10" },
    { clave: "descuento_por_minuto", valor: "0.50" },
    { clave: "zona_horaria", valor: "America/Lima" },
    { clave: "formato_fecha", valor: "YYYY-MM-DD" },
    { clave: "formato_hora", valor: "HH:mm:ss" },
  ];
  for (const c of defaultConfig) {
    await Configuracion.updateOne({ clave: c.clave }, { $set: c }, { upsert: true });
  }

  // Horarios personalizados para algunos empleados
  const horariosEspeciales = [
    { empIdx: 2, dia: 1, franjas: ["08:00", "14:00"] },
    { empIdx: 2, dia: 2, franjas: ["08:00", "10:00", "14:00", "18:00"] },
    { empIdx: 2, dia: 3, franjas: ["08:00", "14:00"] },
    { empIdx: 2, dia: 4, franjas: ["08:00", "10:00", "16:00"] },
    { empIdx: 2, dia: 5, franjas: ["14:00"] },
    { empIdx: 4, dia: 1, franjas: ["08:00", "12:00", "17:00"] },
    { empIdx: 4, dia: 3, franjas: ["08:00", "12:00", "17:00"] },
    { empIdx: 4, dia: 5, franjas: ["08:00", "12:00"] },
    { empIdx: 9, dia: 1, franjas: ["09:00", "11:00", "16:00"] },
    { empIdx: 9, dia: 2, franjas: ["09:00", "14:00"] },
    { empIdx: 9, dia: 4, franjas: ["09:00", "11:00", "16:00"] },
    { empIdx: 13, dia: 1, franjas: ["08:30", "13:00"] },
    { empIdx: 13, dia: 2, franjas: ["08:30", "13:00", "19:00"] },
    { empIdx: 13, dia: 3, franjas: ["08:30"] },
    { empIdx: 13, dia: 4, franjas: ["08:30", "13:00", "19:00"] },
    { empIdx: 13, dia: 5, franjas: ["08:30", "13:00"] },
  ];

  for (const h of horariosEspeciales) {
    await Horario.updateOne(
      { empleado: empleadosCreados[h.empIdx]._id, diaSemana: h.dia },
      { $set: { empleado: empleadosCreados[h.empIdx]._id, diaSemana: h.dia, franjas: h.franjas } },
      { upsert: true }
    );
  }

  const configDocs = await Configuracion.find().lean();
  const cfg = {};
  configDocs.forEach((c) => (cfg[c.clave] = c.valor));

  const hoy = new Date();

  for (let i = 30; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    const fechaStr = fecha.toISOString().split("T")[0];
    const dia = fecha.getDay();

    for (let empIdx = 0; empIdx < empleadosCreados.length; empIdx++) {
      const emp = empleadosCreados[empIdx];
      const empData = empleadosData[empIdx];

      // Obtener franjas para este empleado en este día
      const horarioDoc = await Horario.findOne({ empleado: emp._id, diaSemana: dia }).lean();
      let franjas = horarioDoc?.franjas || null;

      if (!franjas) {
        const areaDoc = await Area.findById(areas[empData.area]._id).lean();
        const franjasArea = areaDoc?.franjasPorDia?.get?.(String(dia)) || areaDoc?.franjasPorDia?.[dia];
        if (franjasArea && franjasArea.length > 0) {
          // Tomar solo 1-2 franjas aleatorias del área
          const shuffled = [...franjasArea].sort(() => Math.random() - 0.5);
          franjas = shuffled.slice(0, Math.min(shuffled.length, Math.floor(Math.random() * 2) + 1));
        }
      }

      if (!franjas || franjas.length === 0) continue;

      for (const franja of franjas) {
        const [hH, hM] = franja.split(":").map(Number);
        const minInicio = hH * 60 + hM;
        const tolerancia = empData.toleranciaMinutos ?? parseInt(cfg.tolerancia_general || "10");

        // Simular diferentes comportamientos: a tiempo, con retraso leve, o con retraso fuerte
        const rand = Math.random();
        let minutosExtra;
        if (rand < 0.55) {
          // 55% a tiempo (0-5 min antes o justo)
          minutosExtra = Math.floor(Math.random() * 6) - 3;
        } else if (rand < 0.80) {
          // 25% retraso leve (dentro de tolerancia o poco más)
          minutosExtra = tolerancia + Math.floor(Math.random() * 10);
        } else if (rand < 0.95) {
          // 15% retraso moderado
          minutosExtra = tolerancia + 10 + Math.floor(Math.random() * 20);
        } else {
          // 5% retraso fuerte
          minutosExtra = tolerancia + 30 + Math.floor(Math.random() * 30);
        }

        const horaMinutos = minInicio + minutosExtra;
        const h = String(Math.floor(Math.max(0, Math.min(23, horaMinutos / 60)))).padStart(2, "0");
        const m = String(Math.max(0, horaMinutos % 60)).padStart(2, "0");
        const s = String(Math.floor(Math.random() * 60)).padStart(2, "0");
        const minutosRetraso = Math.max(0, horaMinutos - (minInicio + tolerancia));

        try {
          await Asistencia.create({
            empleado: emp._id,
            fecha: fechaStr,
            horaMarcacion: `${h}:${m}:${s}`,
            horaEsperada: franja,
            minutosRetraso,
            franja,
          });
        } catch (e) {
          // ignore duplicate
        }
      }
    }
  }

  const mensaje = "Base de datos creada con 20 empleados, 5 áreas y 31 días de asistencia.";
  console.log("✅ " + mensaje);
  console.log("");
  console.log("Credenciales:");
  console.log("  Admin:      admin@empresa.com / admin123");
  console.log("  Empleados:  carlos@empresa.com / 123456");
  console.log("              maria@empresa.com  / 123456");
  console.log("              juan@empresa.com   / 123456");
  console.log("              (y 17 más con misma contraseña)");

  await mongoose.disconnect();
  return { created: true, message: mensaje };
}

const force = process.argv.includes("--force");
seed(force).catch(console.error);

module.exports = { seed };
