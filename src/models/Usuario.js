const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    rol: { type: String, enum: ["admin", "empleado"], required: true },
    activo: { type: Boolean, default: true },
    horaInicio: String,
    toleranciaMinutos: Number,
    descuentoPorMinuto: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Usuario", usuarioSchema);
