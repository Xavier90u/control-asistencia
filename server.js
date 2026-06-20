require("express-async-errors");
const express = require("express");
const session = require("express-session");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const { MongoStore } = require("connect-mongo");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/control-asistencia";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

async function start() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      tlsAllowInvalidCertificates: true,
    });
    console.log("Conectado a MongoDB");
  } catch (e) {
    console.error("Error conectando a MongoDB:", e.message);
    process.exit(1);
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 8 * 60 * 60 * 1000 },
      store: new MongoStore({
        client: mongoose.connection.getClient(),
      }),
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

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

start();
