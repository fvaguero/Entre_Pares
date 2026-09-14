// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { registrarUsuario, loginUsuario } = require('../controllers/authController');

// Endpoint: POST /api/auth/registro
router.post('/registro', registrarUsuario);

// Endpoint: POST /api/auth/login
router.post('/login', loginUsuario);

module.exports = router;