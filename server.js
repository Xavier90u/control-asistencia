const express = require("express");
const session = require("express-session");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
require("dotenv").config();
const { initDB, SQLiteSessionStore } = require("./src/models/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 },
    store: new SQLiteSessionStore(),
  })
);

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use("/", require("./src/routes/auth"));
app.use("/admin", require("./src/routes/admin"));
app.use("/empleado", require("./src/routes/empleado"));

app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  if (req.session.user.rol === "admin") return res.redirect("/admin");
  res.redirect("/empleado");
});

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

start();
