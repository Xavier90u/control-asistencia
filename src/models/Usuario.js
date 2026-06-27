const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    rol: { type: String, enum: ["admin", "empleado"], required: true },
    activo: { type: Boolean, default: true },
    area: { type: mongoose.Schema.Types.ObjectId, ref: "Area" },
    horaInicio: String,
    toleranciaMinutos: Number,
    descuentoPorMinuto: Number,
    telefono: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Usuario", usuarioSchema);
