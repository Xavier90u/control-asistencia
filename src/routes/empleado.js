const { Router } = require("express");
const router = Router();
const { requireEmpleado } = require("../middleware/auth");
const {
  marcacionView,
  marcar,
  qrView,
  marcarQRForm,
  marcarPorQR,
  historialView,
} = require("../controllers/empleadoController");

router.get("/marcar-qr", marcarQRForm);
router.post("/marcar-qr", marcarPorQR);

router.use(requireEmpleado);

router.get("/", marcacionView);
router.post("/marcar", marcar);
router.get("/qr", qrView);
router.get("/historial", historialView);

module.exports = router;
