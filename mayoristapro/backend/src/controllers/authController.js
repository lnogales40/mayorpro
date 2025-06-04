// mayoristapro/backend/src/controllers/authController.js
const AuthService = require('../services/authService');

const AuthController = {
  /**
   * Handles user registration request.
   * POST /api/auth/register
   * Body: { email, password, role, name, supplierType, phoneNumber }
   */
  async register(req, res, next) {
    try {
      // Data like name, supplierType, phoneNumber are optional at controller level,
      // service will validate based on role.
      const { email, password, role, name, supplierType, phoneNumber } = req.body;

      if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, and role are required fields.' });
      }

      const result = await AuthService.registerUser({
          email,
          password,
          role,
          name,               // For supplier or delivery_person
          supplierType,       // For supplier
          phoneNumber         // For delivery_person
        });

      // Consider setting a cookie with the token as well for web clients if not solely API
      res.status(201).json(result);
    } catch (error) {
      console.error('Registration error:', error.message);
      // Differentiate between client errors (e.g., email exists) and server errors
      if (error.message.includes('already in use') ||
          error.message.includes('required for') ||
          error.message.includes('creation failed')) {
        return res.status(400).json({ message: error.message });
      }
      // Pass other errors to the global error handler or handle specifically
      next(error);
    }
  },

  /**
   * Handles user login request.
   * POST /api/auth/login
   * Body: { email, password }
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      const result = await AuthService.loginUser(email, password);
      res.status(200).json(result);
    } catch (error) {
      console.error('Login error:', error.message);
      if (error.message.includes('Invalid credentials') ||
          error.message.includes('User not found') ||
          error.message.includes('Account is inactive')) {
        return res.status(401).json({ message: error.message }); // Unauthorized for login failures
      }
      next(error);
    }
  },

  /**
   * Handles request to get current user's profile.
   * GET /api/users/me (Protected route)
   */
  async getMe(req, res, next) {
    try {
      // req.user is attached by the 'protect' middleware
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Not authorized, user data not found in request.' });
      }
      const userProfile = await AuthService.getMe(req.user.id);
      res.status(200).json(userProfile);
    } catch (error) {
      console.error('GetMe error:', error.message);
      if (error.message.includes('User not found')) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  },
};

module.exports = AuthController;
