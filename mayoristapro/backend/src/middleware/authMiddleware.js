// mayoristapro/backend/src/middleware/authMiddleware.js
const { verifyToken } = require('../utils/jwtUtils');
const UserModel = require('../models/userModel'); // To fetch user details if needed, e.g. to check if active

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded || !decoded.id) {
        return res.status(401).json({ message: 'Not authorized, token failed or user ID missing in token' });
      }

      // Optional: Check if user still exists or is active
      // This adds a DB query to each authenticated request, consider performance implications.
      // For higher security, it's good. For pure speed, JWT payload might be trusted if short-lived.
      const currentUser = await UserModel.findById(decoded.id);
      if (!currentUser || !currentUser.is_active) {
          return res.status(401).json({ message: 'Not authorized, user not found or inactive' });
      }

      // Attach user to request object (excluding sensitive info like password_hash if it were there)
      req.user = {
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
          // Add any other non-sensitive fields from currentUser you might need
      };

      next();
    } catch (error) {
      console.error('Error in auth middleware:', error);
      return res.status(401).json({ message: 'Not authorized, token verification failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// Role-based authorization middleware factory
const authorize = (roles = []) => {
  // roles param can be a single role string (e.g., 'admin')
  // or an array of roles (e.g., ['admin', 'proveedor'])
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
        return res.status(403).json({ message: 'User role not available. Authorization check failed.' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      // User's role is not authorized
      return res.status(403).json({
        message: `Forbidden. User role '${req.user.role}' is not authorized for this resource. Required roles: ${roles.join(', ')}.`
      });
    }
    next(); // Role is authorized
  };
};

// Specific role checks for convenience (can be used directly or with authorize)
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden. Admin access required.' });
  }
};

const isSupplier = (req, res, next) => {
  if (req.user && req.user.role === 'proveedor') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden. Supplier access required.' });
  }
};

const isComprador = (req, res, next) => {
  if (req.user && req.user.role === 'comprador') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden. Buyer access required.' });
  }
};

const isRepartidor = (req, res, next) => {
  if (req.user && req.user.role === 'repartidor') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden. Delivery person access required.' });
  }
};


module.exports = {
  protect,
  authorize,
  isAdmin,
  isSupplier,
  isComprador,
  isRepartidor,
};
