const { Router } = require("express");
const router = Router();
const { requireAdmin } = require("../middleware/auth");
const {
  dashboard, listEmpleados, createEmpleado, editEmpleadoForm, updateEmpleado, toggleEmpleado,
  tardanzasView, configView, updateConfig, seedData,
  areasView, createArea, editAreaForm, updateArea, deleteArea,
  horariosView, updateHorarios,
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
router.post("/seed", seedData);

// Areas
router.get("/areas", areasView);
router.post("/areas", createArea);
router.get("/areas/:id/editar", editAreaForm);
router.post("/areas/:id", updateArea);
router.post("/areas/:id/delete", deleteArea);

// Horarios
router.get("/horarios", horariosView);
router.post("/horarios", updateHorarios);

module.exports = router;
