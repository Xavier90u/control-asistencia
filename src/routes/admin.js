const { Router } = require("express");
const router = Router();
const { requireAdmin } = require("../middleware/auth");
const {
  dashboard,
  listEmpleados,
  createEmpleado,
  editEmpleadoForm,
  updateEmpleado,
  toggleEmpleado,
  tardanzasView,
  configView,
  updateConfig,
} = require("../controllers/adminController");

router.use(requireAdmin);

router.get("/", dashboard);
router.get("/empleados", listEmpleados);
router.post("/empleados", createEmpleado);
router.get("/empleados/:id/editar", editEmpleadoForm);
router.post("/empleados/:id/editar", updateEmpleado);
router.post("/empleados/:id/toggle", toggleEmpleado);
router.get("/tardanzas", tardanzasView);
router.get("/config", configView);
router.post("/config", updateConfig);

module.exports = router;
