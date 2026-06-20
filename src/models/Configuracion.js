const mongoose = require("mongoose");

const configSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true },
  valor: { type: String, required: true },
});

module.exports = mongoose.model("Configuracion", configSchema);
