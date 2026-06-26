const { Router } = require("express");
const router = Router();
const { requireEmpleado } = require("../middleware/auth");
const {
  marcacionView,
  marcar,
  historialView,
} = require("../controllers/empleadoController");

router.use(requireEmpleado);

router.get("/", marcacionView);
router.post("/marcar", marcar);
router.get("/historial", historialView);

module.exports = router;
