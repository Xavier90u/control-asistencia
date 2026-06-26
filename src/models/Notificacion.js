const mongoose = require("mongoose");

const notificacionSchema = new mongoose.Schema(
  {
    empleado: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },
    tipo: {
      type: String,
      enum: ["marcacion", "retraso", "salida", "ausente"],
      required: true,
    },
    mensaje: { type: String, required: true },
    leida: { type: Boolean, default: false },
    fecha: { type: String, required: true },
    hora: { type: String, required: true },
  },
  { timestamps: true }
);

notificacionSchema.index({ leida: 1, createdAt: -1 });

module.exports = mongoose.model("Notificacion", notificacionSchema);
