const mongoose = require('mongoose');

const courtSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    required: true,
    enum: ['circuit', 'magisterial'],
    default: 'magisterial'
  },
  location: {
    type: String,
    trim: true,
    maxlength: 200
  },
  circuitCourtId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Court',
    required: function() {
      return this.type === 'magisterial';
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  contactInfo: {
    phone: String,
    email: String,
    fax: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Index for better query performance
courtSchema.index({ type: 1, isActive: 1 });
courtSchema.index({ circuitCourtId: 1 });

// Virtual for getting magisterial courts under a circuit court
courtSchema.virtual('magisterialCourts', {
  ref: 'Court',
  localField: '_id',
  foreignField: 'circuitCourtId'
});

// Static method to get all circuit courts
courtSchema.statics.getCircuitCourts = function() {
  return this.find({ type: 'circuit', isActive: true })
    .sort({ name: 1 });
};

// Static method to get magisterial courts by circuit court
courtSchema.statics.getMagisterialCourts = function(circuitCourtId) {
  return this.find({ 
    type: 'magisterial', 
    circuitCourtId: circuitCourtId,
    isActive: true 
  })
  .populate('circuitCourtId', 'name')
  .sort({ name: 1 });
};

// Static method to get all magisterial courts
courtSchema.statics.getAllMagisterialCourts = function() {
  return this.find({ type: 'magisterial', isActive: true })
    .populate('circuitCourtId', 'name')
    .sort({ name: 1 });
};

// Instance method to get court with related data
courtSchema.methods.getCourtWithDetails = function() {
  return this.populate([
    { path: 'circuitCourtId', select: 'name' }
  ]);
};

// Pre-save middleware to validate circuit court relationship
courtSchema.pre('save', async function(next) {
  if (this.type === 'magisterial' && this.circuitCourtId) {
    try {
      const circuitCourt = await this.constructor.findById(this.circuitCourtId);
      if (!circuitCourt || circuitCourt.type !== 'circuit') {
        throw new Error('Invalid circuit court reference');
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Court', courtSchema);