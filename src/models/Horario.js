const mongoose = require("mongoose");

const horarioSchema = new mongoose.Schema(
  {
    empleado: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },
    diaSemana: { type: Number, min: 0, max: 6, required: true },
    franjas: [String],
  },
  { timestamps: true }
);

horarioSchema.index({ empleado: 1, diaSemana: 1 }, { unique: true });

module.exports = mongoose.model("Horario", horarioSchema);
