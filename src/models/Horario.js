const mongoose = require("mongoose");

const turnoSchema = new mongoose.Schema(
  {
    horaInicio: { type: String, required: true },
    tolerancia: { type: Number, default: 10 },
    descuentoPorMinuto: { type: Number, default: 0.5 },
  },
  { _id: false }
);

const horarioSchema = new mongoose.Schema(
  {
    empleado: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },
    tipo: {
      type: String,
      enum: ["semanal", "especifico"],
      required: true,
    },
    diaSemana: { type: Number, min: 0, max: 6 },
    fecha: { type: String },
    turnos: [turnoSchema],
  },
  { timestamps: true }
);

horarioSchema.index({ empleado: 1, diaSemana: 1 }, { unique: true, sparse: true });
horarioSchema.index({ empleado: 1, fecha: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Horario", horarioSchema);
