require("express-async-errors");
const express = require("express");
const session = require("express-session");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const { MongoStore } = require("connect-mongo");
const { initDefaults } = require("./src/utils/timezone");
require("dotenv").config();
const { patchDns } = require("./src/utils/dns-patch");

const fs = require("fs");
const app = express();
const PORT = process.env.PORT || 3000;
const CSS_VERSION = fs.statSync(path.join(__dirname, "public/css/output.css")).mtimeMs;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/control-asistencia";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

async function start() {
  try {
    if (MONGO_URI.includes("mongodb+srv")) patchDns();
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      tlsAllowInvalidCertificates: true,
    });
    console.log("Conectado a MongoDB");

    // Eliminar índice único antiguo (empleado + fecha) que bloquea multi-turno
    try {
      const col = mongoose.connection.collection("asistencias");
      const indexes = await col.indexes();
      const oldIdx = indexes.find((i) => i.key?.empleado && i.key?.fecha && i.unique);
      if (oldIdx) {
        await col.dropIndex(oldIdx.name);
        console.log("Índice único obsoleto eliminado:", oldIdx.name);
      }
    } catch (_) { /* ignore */ }

    await initDefaults();
    console.log("Timezone config initialized");
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
    res.locals.CSS_VERSION = CSS_VERSION;
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
