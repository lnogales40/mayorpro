// mayoristapro/backend/src/routes/userRoutes.js
const express = require('express');
const AuthController = require('../controllers/authController'); // getMe is in AuthController
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Protect this route - only authenticated users can access their profile
router.get('/me', protect, AuthController.getMe);

module.exports = router;
