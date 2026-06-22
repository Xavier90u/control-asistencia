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
  seedData,
  horariosView,
  updateHorarioSemanal,
  deleteHorarioSemanal,
  createHorarioEspecifico,
  deleteHorarioEspecifico,
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

// Horarios
router.get("/horarios", horariosView);
router.post("/horarios/semanal", updateHorarioSemanal);
router.post("/horarios/semanal/:empleado_id/:dia_semana/delete", deleteHorarioSemanal);
router.post("/horarios/especifico", createHorarioEspecifico);
router.post("/horarios/especifico/:horario_id/delete", deleteHorarioEspecifico);

module.exports = router;
