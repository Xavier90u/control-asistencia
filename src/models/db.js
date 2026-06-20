const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

const DEFAULT_DB_PATH = path.join(__dirname, "..", "..", "database.sqlite");
let DB_PATH = process.env.DB_PATH || DEFAULT_DB_PATH;

function resolveDBPath() {
  if (!process.env.DB_PATH) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return;
  }
  const dir = path.dirname(DB_PATH);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const testFile = path.join(dir, ".write-test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
  } catch (e) {
    console.warn(
      `[DB] No se pudo usar DB_PATH=${DB_PATH}, usando local. Razón: ${e.message}`
    );
    DB_PATH = DEFAULT_DB_PATH;
    const fallbackDir = path.dirname(DB_PATH);
    if (!fs.existsSync(fallbackDir))
      fs.mkdirSync(fallbackDir, { recursive: true });
  }
}

resolveDBPath();

let db = null;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON");
  createTables();
  save();
  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('admin', 'empleado')),
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS empleados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER UNIQUE NOT NULL,
      hora_inicio TEXT,
      tolerancia_minutos INTEGER,
      descuento_por_minuto REAL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      hora_marcacion TEXT NOT NULL,
      hora_esperada TEXT NOT NULL,
      minutos_retraso INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (empleado_id) REFERENCES empleados(id),
      UNIQUE(empleado_id, fecha)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT UNIQUE NOT NULL,
      valor TEXT NOT NULL
    )
  `);
  addSessionTable();
  insertDefaults();
}

function insertDefaults() {
  const configs = [
    { clave: "hora_inicio_general", valor: "08:00" },
    { clave: "tolerancia_general", valor: "10" },
    { clave: "descuento_por_minuto", valor: "0.50" },
  ];
  for (const c of configs) {
    const existing = db.exec(
      `SELECT id FROM configuracion WHERE clave = '${c.clave}'`
    );
    if (!existing.length || !existing[0].values.length) {
      db.run("INSERT INTO configuracion (clave, valor) VALUES (?, ?)", [
        c.clave,
        c.valor,
      ]);
    }
  }
}

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows.length ? rows[0] : null;
}

function exec(sql) {
  const result = db.exec(sql);
  save();
  return result;
}

class SQLiteSessionStore extends session.Store {
  get(sid, cb) {
    try {
      const row = get(
        "SELECT data FROM sessions WHERE sid = ? AND expires > datetime('now')",
        [sid]
      );
      cb(null, row ? JSON.parse(row.data) : null);
    } catch (e) {
      cb(e);
    }
  }
  set(sid, session, cb) {
    try {
      const maxAge = (session.cookie && session.cookie.maxAge) || 86400000;
      const expires = new Date(Date.now() + maxAge).toISOString();
      run("DELETE FROM sessions WHERE sid = ?", [sid]);
      run(
        "INSERT OR REPLACE INTO sessions (sid, data, expires) VALUES (?, ?, ?)",
        [sid, JSON.stringify(session), expires]
      );
      cb(null);
    } catch (e) {
      cb(e);
    }
  }
  destroy(sid, cb) {
    try {
      run("DELETE FROM sessions WHERE sid = ?", [sid]);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }
  touch(sid, session, cb) {
    try {
      const maxAge = (session.cookie && session.cookie.maxAge) || 86400000;
      const expires = new Date(Date.now() + maxAge).toISOString();
      run("UPDATE sessions SET expires = ? WHERE sid = ?", [expires, sid]);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }
}

function addSessionTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires TEXT NOT NULL
    )
  `);
}

module.exports = { initDB, run, query, get, exec, SQLiteSessionStore, addSessionTable };
