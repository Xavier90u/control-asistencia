const db = require("../models/db");

function marcacionView(req, res) {
  const userId = req.session.user.id;
  const empleado = db.get(
    "SELECT e.* FROM empleados e WHERE e.usuario_id = ?",
    [userId]
  );

  const hoy = new Date();
  const fechaStr = hoy.toISOString().split("T")[0];

  const asistenciaHoy = db.get(
    "SELECT * FROM asistencia WHERE empleado_id = ? AND fecha = ?",
    [empleado.id, fechaStr]
  );

  const config = getConfigMap();

  res.render("empleado/marcacion", {
    empleado,
    asistenciaHoy,
    config,
    horaActual: hoy.toLocaleTimeString("es-PE", { hour12: false }),
  });
}

function marcar(req, res) {
  const userId = req.session.user.id;
  const empleado = db.get(
    "SELECT e.* FROM empleados e WHERE e.usuario_id = ?",
    [userId]
  );

  if (!empleado) return res.redirect("/empleado?error=Empleado no encontrado");

  const hoy = new Date();
  const fechaStr = hoy.toISOString().split("T")[0];
  const horaStr = hoy.toLocaleTimeString("es-PE", { hour12: false });

  const existing = db.get(
    "SELECT id FROM asistencia WHERE empleado_id = ? AND fecha = ?",
    [empleado.id, fechaStr]
  );
  if (existing)
    return res.redirect("/empleado?error=Ya marcaste entrada hoy");

  const config = getConfigMap();

  const horaInicio = empleado.hora_inicio || config.hora_inicio_general || "08:00";
  const tolerancia = empleado.tolerancia_minutos !== null
    ? empleado.tolerancia_minutos
    : parseInt(config.tolerancia_general || "10");

  const [horaEsperadaH, minEsperadoM] = horaInicio.split(":").map(Number);
  const [horaActualH, minActualM] = horaStr.split(":").map(Number);

  const minutosEsperados = horaEsperadaH * 60 + minEsperadoM + tolerancia;
  const minutosActuales = horaActualH * 60 + minActualM;
  const minutosRetraso = Math.max(0, minutosActuales - minutosEsperados);

  db.run(
    `INSERT INTO asistencia (empleado_id, fecha, hora_marcacion, hora_esperada, minutos_retraso) VALUES (?, ?, ?, ?, ?)`,
    [empleado.id, fechaStr, horaStr, horaInicio, minutosRetraso]
  );

  if (minutosRetraso > 0) {
    res.redirect(
      `/empleado?success=Entrada registrada&retraso=${minutosRetraso}`
    );
  } else {
    res.redirect("/empleado?success=Entrada registrada a tiempo");
  }
}

function historialView(req, res) {
  const userId = req.session.user.id;
  const empleado = db.get(
    "SELECT e.* FROM empleados e WHERE e.usuario_id = ?",
    [userId]
  );

  const page = parseInt(req.query.page) || 1;
  const limit = 15;
  const offset = (page - 1) * limit;

  const total = db.get(
    "SELECT COUNT(*) as count FROM asistencia WHERE empleado_id = ?",
    [empleado.id]
  );
  const totalPages = Math.ceil(total.count / limit);

  const registros = db.query(
    "SELECT * FROM asistencia WHERE empleado_id = ? ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?",
    [empleado.id, limit, offset]
  );

  const resumen = db.get(
    `SELECT 
      COUNT(*) as total_dias,
      SUM(CASE WHEN minutos_retraso > 0 THEN 1 ELSE 0 END) as tardanzas,
      SUM(minutos_retraso) as total_minutos_retraso
     FROM asistencia WHERE empleado_id = ?`,
    [empleado.id]
  );

  res.render("empleado/historial", {
    registros,
    resumen,
    page,
    totalPages,
  });
}

function getConfigMap() {
  const configs = db.query("SELECT * FROM configuracion");
  const map = {};
  configs.forEach((c) => (map[c.clave] = c.valor));
  return map;
}

module.exports = { marcacionView, marcar, historialView };
