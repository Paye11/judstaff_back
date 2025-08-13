const express = require('express');
const { body, validationResult } = require('express-validator');
const Court = require('../models/Court');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all circuit courts
router.get('/circuit', authenticateToken, async (req, res) => {
  try {
    const courts = await Court.getCircuitCourts();
    
    res.json({
      success: true,
      courts
    });
  } catch (error) {
    console.error('Get circuit courts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all magisterial courts
router.get('/magisterial', authenticateToken, async (req, res) => {
  try {
    const courts = await Court.getAllMagisterialCourts();
    
    res.json({
      success: true,
      courts
    });
  } catch (error) {
    console.error('Get magisterial courts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get magisterial courts by circuit court ID
router.get('/circuit/:circuitId/magisterial', authenticateToken, async (req, res) => {
  try {
    const { circuitId } = req.params;
    const courts = await Court.getMagisterialCourts(circuitId);
    
    res.json({
      success: true,
      courts
    });
  } catch (error) {
    console.error('Get magisterial courts by circuit error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get court by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const court = await Court.findById(req.params.id)
      .populate('userId', 'name username')
      .populate('circuitCourtId', 'name');
    
    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }
    
    res.json({
      success: true,
      court
    });
  } catch (error) {
    console.error('Get court error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new circuit court (admin only)
router.post('/circuit', [
  authenticateToken,
  requireRole(['admin']),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Court name must be at least 2 characters long'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must not exceed 200 characters')
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

    const { name, location, address, contactInfo, description } = req.body;

    // Create circuit court as organizational unit only
    const court = new Court({
      name,
      type: 'circuit',
      location,
      address,
      contactInfo,
      description
    });
    await court.save();

    res.status(201).json({
      success: true,
      message: 'Circuit court created successfully',
      court
    });

  } catch (error) {
    console.error('Create circuit court error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new magisterial court (admin or circuit court)
router.post('/magisterial', [
  authenticateToken,
  requireRole(['admin']),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Court name must be at least 2 characters long'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must not exceed 200 characters'),
  body('circuitCourtId')
    .notEmpty()
    .withMessage('Circuit court ID is required')
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

    const { name, location, circuitCourtId, address, contactInfo, description } = req.body;

    // Check if circuit court exists
    const circuitCourt = await Court.findById(circuitCourtId);
    if (!circuitCourt || circuitCourt.type !== 'circuit') {
      return res.status(400).json({
        success: false,
        message: 'Invalid circuit court'
      });
    }

    // Create magisterial court as organizational unit only
    const court = new Court({
      name,
      type: 'magisterial',
      location,
      circuitCourtId,
      address,
      contactInfo,
      description
    });
    await court.save();

    // Populate the court with circuit court details
    await court.populate([
      { path: 'circuitCourtId', select: 'name' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Magisterial court created successfully',
      court
    });

  } catch (error) {
    console.error('Create magisterial court error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update court
router.put('/:id', [
  authenticateToken,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Court name must be at least 2 characters long')
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

    const courtId = req.params.id;
    const { name, address, contactInfo, description } = req.body;

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    // Only admin can update courts
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update court fields
    if (name) court.name = name;
    if (address) court.address = address;
    if (contactInfo) court.contactInfo = contactInfo;
    if (description) court.description = description;

    await court.save();
    await court.populate('circuitCourtId', 'name');

    res.json({
      success: true,
      message: 'Court updated successfully',
      court
    });

  } catch (error) {
    console.error('Update court error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Deactivate court (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const courtId = req.params.id;

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    court.isActive = false;
    await court.save();

    res.json({
      success: true,
      message: 'Court deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate court error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});



module.exports = router;