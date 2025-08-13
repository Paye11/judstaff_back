const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('-password')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('circuitCourtId', 'name');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has permission to view this user
    if (req.user.role !== 'admin' && req.user.userId !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new user (admin only)
router.post('/', [
  authenticateToken,
  requireRole(['admin']),
  body('username')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long')
    .isAlphanumeric()
    .withMessage('Username must contain only letters and numbers'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('role')
    .isIn(['admin'])
    .withMessage('Invalid role')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, password, name, role, circuitCourtId } = req.body;

    // Check if username already exists
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Create new user
    const userData = {
      username,
      password,
      name,
      role
    };

    // Add circuitCourtId for magisterial users
    if (role === 'magisterial' && circuitCourtId) {
      userData.circuitCourtId = circuitCourtId;
    }

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        circuitCourtId: user.circuitCourtId
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user (admin only or own profile)
router.put('/:id', [
  authenticateToken,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('role')
    .optional()
    .isIn(['admin'])
    .withMessage('Invalid role')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.params.id;
    const { name, role, circuitCourtId, isActive } = req.body;

    // Check if user has permission to update this user
    if (req.user.role !== 'admin' && req.user.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Non-admin users can only update their own name
    if (req.user.role !== 'admin' && (role || circuitCourtId || isActive !== undefined)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - insufficient permissions'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user fields
    if (name) user.name = name;
    if (role && req.user.role === 'admin') user.role = role;
    if (circuitCourtId && req.user.role === 'admin') user.circuitCourtId = circuitCourtId;
    if (isActive !== undefined && req.user.role === 'admin') user.isActive = isActive;

    await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        circuitCourtId: user.circuitCourtId,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Deactivate user (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deactivating themselves
    if (req.user.userId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get users by role
router.get('/role/:role', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { role } = req.params;
    
    if (!['admin', 'circuit', 'magisterial'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    const users = await User.find({ role, isActive: true })
      .select('-password')
      .populate('circuitCourtId', 'name')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;