const { initDB, run, query, get } = require("./src/models/db");
const bcrypt = require("bcryptjs");

async function seed() {
  await initDB();

  const adminExists = get("SELECT id FROM usuarios WHERE email = ?", [
    "admin@empresa.com",
  ]);
  if (adminExists) {
    console.log("La base de datos ya tiene datos. Elimina database.sqlite para resetear.");
    return;
  }

  const adminPass = bcrypt.hashSync("admin123", 10);
  run(
    "INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, 'admin')",
    ["Administrador", "admin@empresa.com", adminPass]
  );

  const empleados = [
    {
      nombre: "Carlos López",
      email: "carlos@empresa.com",
      password: "123456",
      hora_inicio: null,
      tolerancia_minutos: null,
      descuento_por_minuto: null,
    },
    {
      nombre: "María García",
      email: "maria@empresa.com",
      password: "123456",
      hora_inicio: "08:30",
      tolerancia_minutos: 15,
      descuento_por_minuto: null,
    },
    {
      nombre: "Juan Pérez",
      email: "juan@empresa.com",
      password: "123456",
      hora_inicio: null,
      tolerancia_minutos: 5,
      descuento_por_minuto: 0.75,
    },
    {
      nombre: "Ana Torres",
      email: "ana@empresa.com",
      password: "123456",
      hora_inicio: null,
      tolerancia_minutos: null,
      descuento_por_minuto: null,
    },
  ];

  for (const emp of empleados) {
    const pass = bcrypt.hashSync(emp.password, 10);
    run(
      "INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, 'empleado')",
      [emp.nombre, emp.email, pass]
    );
    const user = get("SELECT id FROM usuarios WHERE email = ?", [emp.email]);
    run(
      "INSERT INTO empleados (usuario_id, hora_inicio, tolerancia_minutos, descuento_por_minuto) VALUES (?, ?, ?, ?)",
      [
        user.id,
        emp.hora_inicio,
        emp.tolerancia_minutos,
        emp.descuento_por_minuto,
      ]
    );
  }

  const empleadosDb = query(
    "SELECT e.id, u.nombre FROM empleados e JOIN usuarios u ON u.id = e.usuario_id"
  );
  const hoy = new Date();
  for (let i = 5; i >= 0; i--) {
    for (const emp of empleadosDb) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      if (fecha.getDay() === 0 || fecha.getDay() === 6) continue;

      const fechaStr = fecha.toISOString().split("T")[0];
      const horaBase = 8;
      const minBase = Math.floor(Math.random() * 30);
      const retraso = Math.floor(Math.random() * 25);

      const horaMinutos = horaBase * 60 + minBase + retraso;
      const hora = String(Math.floor(horaMinutos / 60)).padStart(2, "0");
      const min = String(horaMinutos % 60).padStart(2, "0");
      const seg = String(Math.floor(Math.random() * 60)).padStart(2, "0");

      run(
        "INSERT OR IGNORE INTO asistencia (empleado_id, fecha, hora_marcacion, hora_esperada, minutos_retraso) VALUES (?, ?, ?, ?, ?)",
        [emp.id, fechaStr, `${hora}:${min}:${seg}`, "08:00", retraso]
      );
    }
  }

  console.log("✅ Base de datos creada con datos demo.");
  console.log("");
  console.log("Credenciales:");
  console.log("  Admin:     admin@empresa.com / admin123");
  console.log("  Empleados: carlos@empresa.com / 123456");
  console.log("             maria@empresa.com  / 123456");
  console.log("             juan@empresa.com   / 123456");
  console.log("             ana@empresa.com    / 123456");
  console.log("");
  console.log("Ejecuta 'npm start' para iniciar el servidor.");
}

seed().catch(console.error);
