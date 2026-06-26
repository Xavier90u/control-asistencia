const bcrypt = require("bcryptjs");
const Usuario = require("../models/Usuario");

function loginForm(req, res) {
  if (req.session.user) {
    if (req.session.user.rol === "admin") return res.redirect("/admin");
    return res.redirect("/empleado");
  }
  res.render("auth/login", { error: null });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.render("auth/login", { error: "Completa todos los campos" });

  const user = await Usuario.findOne({ email, activo: true });
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.render("auth/login", { error: "Credenciales incorrectas" });

  req.session.user = {
    id: user._id.toString(),
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
