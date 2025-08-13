const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    // Add user info to request object
    req.user = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
      name: user.name,
      circuitCourtId: user.circuitCourtId
    };

    next();
  } catch (error) {
    console.error('Token authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Middleware to require specific roles
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Middleware to require admin role
const requireAdmin = (req, res, next) => {
  return requireRole(['admin'])(req, res, next);
};

// Middleware to require circuit court role or higher
const requireCircuitOrAdmin = (req, res, next) => {
  return requireRole(['admin', 'circuit'])(req, res, next);
};

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    if (resourceUserId && resourceUserId === req.user.userId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied - you can only access your own resources'
    });
  };
};

// Middleware to validate request body fields
const validateFields = (requiredFields, optionalFields = []) => {
  return (req, res, next) => {
    const missingFields = [];
    const allowedFields = [...requiredFields, ...optionalFields];
    
    // Check for required fields
    requiredFields.forEach(field => {
      if (!req.body.hasOwnProperty(field) || req.body[field] === undefined || req.body[field] === '') {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    // Remove any fields that are not allowed
    const filteredBody = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });
    
    req.body = filteredBody;
    next();
  };
};

// Middleware to log API requests (optional)
const logRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userInfo = req.user ? `${req.user.username} (${req.user.role})` : 'Anonymous';
  
  console.log(`[${timestamp}] ${method} ${url} - User: ${userInfo}`);
  next();
};

// Middleware to handle async errors
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireCircuitOrAdmin,
  requireOwnershipOrAdmin,
  validateFields,
  logRequest,
  asyncHandler
};