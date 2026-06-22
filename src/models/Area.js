const mongoose = require("mongoose");

const areaSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, unique: true },
    franjasPorDia: {
      type: Map,
      of: [String],
      default: {
        0: ["08:00", "11:00"],
        1: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
        2: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
        3: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
        4: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
        5: ["08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
        6: ["08:00", "15:00"],
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Area", areaSchema);
