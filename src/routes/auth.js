const { Router } = require("express");
const router = Router();
const { loginForm, login, logout } = require("../controllers/authController");

router.get("/login", loginForm);
router.post("/login", login);
router.get("/logout", logout);

module.exports = router;
