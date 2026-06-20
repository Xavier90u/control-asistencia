const bcrypt = require("bcryptjs");
const db = require("../models/db");

function loginForm(req, res) {
  if (req.session.user) {
    if (req.session.user.rol === "admin") return res.redirect("/admin");
    return res.redirect("/empleado");
  }
  res.render("auth/login", { error: null });
}

function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.render("auth/login", { error: "Completa todos los campos" });

  const user = db.get("SELECT * FROM usuarios WHERE email = ? AND activo = 1", [
    email,
  ]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.render("auth/login", { error: "Credenciales incorrectas" });

  req.session.user = {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
  };

  if (user.rol === "admin") return res.redirect("/admin");
  res.redirect("/empleado");
}

function logout(req, res) {
  req.session.destroy();
  res.redirect("/login");
}

module.exports = { loginForm, login, logout };
