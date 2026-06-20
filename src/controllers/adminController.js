const bcrypt = require("bcryptjs");
const db = require("../models/db");

function dashboard(req, res) {
  const totalEmpleados = db.get(
    "SELECT COUNT(*) as total FROM usuarios WHERE rol = 'empleado' AND activo = 1"
  );
  const asistenciasHoy = db.get(
    "SELECT COUNT(*) as total FROM asistencia WHERE fecha = date('now', 'localtime')"
  );
  const tardanzasHoy = db.get(
    "SELECT COUNT(*) as total FROM asistencia WHERE fecha = date('now', 'localtime') AND minutos_retraso > 0"
  );
  const config = getConfigMap();

  res.render("admin/dashboard", {
    totalEmpleados: totalEmpleados.total,
    asistenciasHoy: asistenciasHoy.total,
    tardanzasHoy: tardanzasHoy.total,
    config,
  });
}

function listEmpleados(req, res) {
  const empleados = db.query(`
    SELECT u.id, u.nombre, u.email, u.activo, u.created_at,
           e.hora_inicio, e.tolerancia_minutos, e.descuento_por_minuto
    FROM usuarios u
    LEFT JOIN empleados e ON e.usuario_id = u.id
    WHERE u.rol = 'empleado'
    ORDER BY u.activo DESC, u.nombre ASC
  `);
  res.render("admin/empleados", { empleados });
}

function createEmpleado(req, res) {
  const { nombre, email, password, hora_inicio, tolerancia_minutos, descuento_por_minuto } = req.body;
  if (!nombre || !email || !password)
    return res.redirect("/admin/empleados?error=Completa todos los campos");

  const existing = db.get("SELECT id FROM usuarios WHERE email = ?", [email]);
  if (existing)
    return res.redirect("/admin/empleados?error=El email ya existe");

  const hashed = bcrypt.hashSync(password, 10);
  db.run(
    "INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, 'empleado')",
    [nombre, email, hashed]
  );
  const usuario = db.get("SELECT id FROM usuarios WHERE email = ?", [email]);
  db.run(
    "INSERT INTO empleados (usuario_id, hora_inicio, tolerancia_minutos, descuento_por_minuto) VALUES (?, ?, ?, ?)",
    [
      usuario.id,
      hora_inicio || null,
      tolerancia_minutos ? parseInt(tolerancia_minutos) : null,
      descuento_por_minuto ? parseFloat(descuento_por_minuto) : null,
    ]
  );
  res.redirect("/admin/empleados?success=Empleado creado exitosamente");
}

function editEmpleadoForm(req, res) {
  const empleado = db.get(
    `SELECT u.id, u.nombre, u.email, u.activo,
            e.hora_inicio, e.tolerancia_minutos, e.descuento_por_minuto
     FROM usuarios u
     LEFT JOIN empleados e ON e.usuario_id = u.id
     WHERE u.id = ? AND u.rol = 'empleado'`,
    [req.params.id]
  );
  if (!empleado) return res.redirect("/admin/empleados?error=Empleado no encontrado");
  res.render("admin/editar_empleado", { empleado });
}

function updateEmpleado(req, res) {
  const { nombre, email, password, hora_inicio, tolerancia_minutos, descuento_por_minuto } = req.body;
  const userId = req.params.id;

  const user = db.get("SELECT id FROM usuarios WHERE id = ?", [userId]);
  if (!user) return res.redirect("/admin/empleados?error=Empleado no encontrado");

  if (password && password.trim()) {
    const hashed = bcrypt.hashSync(password, 10);
    db.run("UPDATE usuarios SET nombre = ?, email = ?, password = ? WHERE id = ?", [
      nombre,
      email,
      hashed,
      userId,
    ]);
  } else {
    db.run("UPDATE usuarios SET nombre = ?, email = ? WHERE id = ?", [
      nombre,
      email,
      userId,
    ]);
  }

  db.run(
    `UPDATE empleados SET hora_inicio = ?, tolerancia_minutos = ?, descuento_por_minuto = ? WHERE usuario_id = ?`,
    [
      hora_inicio || null,
      tolerancia_minutos ? parseInt(tolerancia_minutos) : null,
      descuento_por_minuto ? parseFloat(descuento_por_minuto) : null,
      userId,
    ]
  );
  res.redirect("/admin/empleados?success=Empleado actualizado");
}

function toggleEmpleado(req, res) {
  const user = db.get("SELECT id, activo FROM usuarios WHERE id = ?", [
    req.params.id,
  ]);
  if (!user) return res.redirect("/admin/empleados?error=Empleado no encontrado");
  db.run("UPDATE usuarios SET activo = ? WHERE id = ?", [
    user.activo ? 0 : 1,
    user.id,
  ]);
  res.redirect("/admin/empleados?success=Estado actualizado");
}

function tardanzasView(req, res) {
  const { fecha_desde, fecha_hasta, empleado_id } = req.query;
  let sql = `
    SELECT a.id, a.fecha, a.hora_marcacion, a.hora_esperada, a.minutos_retraso,
           u.nombre as empleado_nombre, u.email as empleado_email,
           COALESCE(e.descuento_por_minuto, CAST(cg.valor AS REAL), 0.5) as descuento_x_minuto,
           a.minutos_retraso * COALESCE(e.descuento_por_minuto, CAST(cg.valor AS REAL), 0.5) as descuento_total
    FROM asistencia a
    JOIN empleados emp ON emp.id = a.empleado_id
    JOIN usuarios u ON u.id = emp.usuario_id
    LEFT JOIN configuracion cg ON cg.clave = 'descuento_por_minuto'
    LEFT JOIN empleados e ON e.usuario_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (fecha_desde) {
    sql += " AND a.fecha >= ?";
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    sql += " AND a.fecha <= ?";
    params.push(fecha_hasta);
  }
  if (empleado_id) {
    sql += " AND emp.usuario_id = ?";
    params.push(empleado_id);
  }

  sql += " ORDER BY a.fecha DESC, a.hora_marcacion DESC";

  const registros = db.query(sql, params);
  const empleados = db.query(
    "SELECT u.id, u.nombre FROM usuarios u WHERE u.rol = 'empleado' AND u.activo = 1 ORDER BY u.nombre"
  );

  res.render("admin/tardanzas", { registros, empleados, filtros: req.query });
}

function configView(req, res) {
  const configs = db.query("SELECT * FROM configuracion ORDER BY id");
  const configMap = {};
  configs.forEach((c) => (configMap[c.clave] = c.valor));
  res.render("admin/config", { config: configMap });
}

function updateConfig(req, res) {
  const { hora_inicio_general, tolerancia_general, descuento_por_minuto } =
    req.body;

  if (hora_inicio_general)
    db.run(
      "UPDATE configuracion SET valor = ? WHERE clave = 'hora_inicio_general'",
      [hora_inicio_general]
    );
  if (tolerancia_general)
    db.run(
      "UPDATE configuracion SET valor = ? WHERE clave = 'tolerancia_general'",
      [tolerancia_general]
    );
  if (descuento_por_minuto)
    db.run(
      "UPDATE configuracion SET valor = ? WHERE clave = 'descuento_por_minuto'",
      [descuento_por_minuto]
    );

  res.redirect("/admin/config?success=Configuración actualizada");
}

async function seedData(req, res) {
  const { seed } = require("../../seed");
  const result = await seed(true);
  res.redirect(
    `/admin?success=${encodeURIComponent(result.message)}`
  );
}

function getConfigMap() {
  const configs = db.query("SELECT * FROM configuracion");
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
