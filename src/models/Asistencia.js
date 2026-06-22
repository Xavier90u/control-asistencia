const mongoose = require("mongoose");

const asistenciaSchema = new mongoose.Schema(
  {
    empleado: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },
    fecha: { type: String, required: true },
    horaMarcacion: { type: String, required: true },
    horaEsperada: { type: String, required: true },
    minutosRetraso: { type: Number, default: 0 },
    turnoIndex: { type: Number, default: 0 },
    franja: { type: String },
    latitud: { type: Number },
    longitud: { type: Number },
  },
  { timestamps: true }
);

asistenciaSchema.index({ empleado: 1, fecha: 1, turnoIndex: 1 });

module.exports = mongoose.model("Asistencia", asistenciaSchema);
