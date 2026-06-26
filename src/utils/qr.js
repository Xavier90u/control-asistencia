const jwt = require("jsonwebtoken");

const QR_SECRET = process.env.QR_SECRET || "asistencia-qr-secret-2026";
const QR_EXPIRY = "24h";

function generarTokenQR(empleadoId) {
  return jwt.sign(
    { emp: empleadoId, type: "clockin" },
    QR_SECRET,
    { expiresIn: QR_EXPIRY }
  );
}

function verificarTokenQR(token) {
  try {
    return jwt.verify(token, QR_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = { generarTokenQR, verificarTokenQR };
