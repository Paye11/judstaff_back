const express = require('express');
const { body, validationResult } = require('express-validator');
const Staff = require('../models/Staff');
const Court = require('../models/Court');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all staff (admin only)
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const staff = await Staff.find({})
      .populate('courtId', 'name type')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      staff
    });
  } catch (error) {
    console.error('Get all staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get staff by employment status
router.get('/status/:status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.params;
    
    if (!['active', 'retired', 'dismissed', 'on_leave'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employment status'
      });
    }

    let staff;
    
    if (req.user.role === 'admin') {
      // Admin can see all staff
      staff = await Staff.getByStatus(status);
    } else {
      // Circuit and magisterial courts can only see their own staff
      const userCourts = await Court.find({ userId: req.user.userId, isActive: true });
      const courtIds = userCourts.map(court => court._id);
      
      if (req.user.role === 'circuit') {
        // Circuit court can see staff from their court and magisterial courts under them
        const magisterialCourts = await Court.find({ 
          circuitCourtId: { $in: courtIds },
          isActive: true 
        });
        const allCourtIds = [...courtIds, ...magisterialCourts.map(court => court._id)];
        
        staff = await Staff.find({ 
          employmentStatus: status,
          courtId: { $in: allCourtIds }
        })
        .populate('courtId', 'name type')
        .sort({ name: 1 });
      } else {
        // Magisterial court can only see their own staff
        staff = await Staff.find({ 
          employmentStatus: status,
          courtId: { $in: courtIds }
        })
        .populate('courtId', 'name type')
        .sort({ name: 1 });
      }
    }
    
    res.json({
      success: true,
      staff
    });
  } catch (error) {
    console.error('Get staff by status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get staff by court
router.get('/court/:courtId', authenticateToken, async (req, res) => {
  try {
    const { courtId } = req.params;
    
    // Check if user has permission to view this court's staff
    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin') {
      if (court.userId.toString() !== req.user.userId) {
        // For circuit courts, also check if it's a magisterial court under their circuit
        if (req.user.role === 'circuit') {
          const userCourt = await Court.findOne({ userId: req.user.userId, type: 'circuit' });
          if (!userCourt || court.circuitCourtId?.toString() !== userCourt._id.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Access denied'
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }
    }
    
    const staff = await Staff.getByCourt(courtId);
    
    res.json({
      success: true,
      staff
    });
  } catch (error) {
    console.error('Get staff by court error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get staff statistics
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    let stats;
    
    if (req.user.role === 'admin') {
      // Admin gets all statistics
      stats = await Staff.getStatistics();
    } else {
      // Circuit and magisterial courts get their own statistics
      const userCourts = await Court.find({ userId: req.user.userId, isActive: true });
      const courtIds = userCourts.map(court => court._id);
      
      if (req.user.role === 'circuit') {
        // Include magisterial courts under this circuit
        const magisterialCourts = await Court.find({ 
          circuitCourtId: { $in: courtIds },
          isActive: true 
        });
        courtIds.push(...magisterialCourts.map(court => court._id));
      }
      
      const staffStats = await Staff.aggregate([
        { $match: { courtId: { $in: courtIds } } },
        {
          $group: {
            _id: '$employmentStatus',
            count: { $sum: 1 }
          }
        }
      ]);
      
      stats = {
        total: 0,
        active: 0,
        retired: 0,
        dismissed: 0,
        on_leave: 0
      };
      
      staffStats.forEach(stat => {
        stats[stat._id] = stat.count;
        stats.total += stat.count;
      });
    }
    
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Get staff statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get staff member by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id)
      .populate('courtId', 'name type circuitCourtId');
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin') {
      const court = staff.courtId;
      if (court.userId?.toString() !== req.user.userId) {
        // For circuit courts, check if it's a magisterial court under their circuit
        if (req.user.role === 'circuit') {
          const userCourt = await Court.findOne({ userId: req.user.userId, type: 'circuit' });
          if (!userCourt || court.circuitCourtId?.toString() !== userCourt._id.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Access denied'
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }
    }
    
    res.json({
      success: true,
      staff
    });
  } catch (error) {
    console.error('Get staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new staff member
router.post('/', [
  authenticateToken,
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('position')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Position must be at least 2 characters long'),
  body('courtId')
    .notEmpty()
    .withMessage('Court ID is required'),
  body('courtType')
    .isIn(['circuit', 'magisterial'])
    .withMessage('Invalid court type'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email address'),
  body('employmentStatus')
    .optional()
    .isIn(['active', 'retired', 'dismissed', 'on_leave'])
    .withMessage('Invalid employment status')
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

    const { courtId, courtType, ...staffData } = req.body;

    // Check if court exists and user has permission
    const court = await Court.findById(courtId);
    if (!court || court.type !== courtType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid court'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin') {
      if (court.userId.toString() !== req.user.userId) {
        // For circuit courts, check if it's a magisterial court under their circuit
        if (req.user.role === 'circuit') {
          const userCourt = await Court.findOne({ userId: req.user.userId, type: 'circuit' });
          if (!userCourt || court.circuitCourtId?.toString() !== userCourt._id.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Access denied'
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }
    }

    // Create new staff member
    const staff = new Staff({
      ...staffData,
      courtId,
      courtType
    });
    await staff.save();
    await staff.populate('courtId', 'name type');

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      staff
    });

  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update staff member
router.put('/:id', [
  authenticateToken,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('position')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Position must be at least 2 characters long'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email address'),
  body('employmentStatus')
    .optional()
    .isIn(['active', 'retired', 'dismissed', 'on_leave'])
    .withMessage('Invalid employment status')
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

    const staffId = req.params.id;
    const updateData = req.body;

    const staff = await Staff.findById(staffId).populate('courtId');
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin') {
      const court = staff.courtId;
      if (court.userId?.toString() !== req.user.userId) {
        // For circuit courts, check if it's a magisterial court under their circuit
        if (req.user.role === 'circuit') {
          const userCourt = await Court.findOne({ userId: req.user.userId, type: 'circuit' });
          if (!userCourt || court.circuitCourtId?.toString() !== userCourt._id.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Access denied'
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }
    }

    // Handle employment status change
    if (updateData.employmentStatus && updateData.employmentStatus !== staff.employmentStatus) {
      await staff.updateEmploymentStatus(updateData.employmentStatus, updateData.statusDate);
    } else {
      // Update other fields
      Object.keys(updateData).forEach(key => {
        if (key !== 'employmentStatus' && key !== 'statusDate') {
          staff[key] = updateData[key];
        }
      });
      await staff.save();
    }

    await staff.populate('courtId', 'name type');

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      staff
    });

  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete staff member (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const staffId = req.params.id;

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    await Staff.findByIdAndDelete(staffId);

    res.json({
      success: true,
      message: 'Staff member deleted successfully'
    });

  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;