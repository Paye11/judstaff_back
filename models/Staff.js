const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  position: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  courtType: {
    type: String,
    required: true,
    enum: ['circuit', 'magisterial']
  },
  courtId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Court',
    required: true
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 100,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  education: {
    type: String,
    trim: true,
    maxlength: 100
  },
  employmentStatus: {
    type: String,
    required: true,
    enum: ['active', 'retired', 'dismissed', 'on_leave'],
    default: 'active'
  },
  hireDate: {
    type: Date,
    default: Date.now
  },
  retirementDate: {
    type: Date,
    required: function() {
      return this.employmentStatus === 'retired';
    }
  },
  dismissalDate: {
    type: Date,
    required: function() {
      return this.employmentStatus === 'dismissed';
    }
  },
  leaveStartDate: {
    type: Date,
    required: function() {
      return this.employmentStatus === 'on_leave';
    }
  },
  leaveEndDate: {
    type: Date
  },
  salary: {
    type: Number,
    min: 0
  },
  department: {
    type: String,
    trim: true,
    maxlength: 100
  },
  supervisor: {
    type: String,
    trim: true,
    maxlength: 100
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  emergencyContact: {
    name: {
      type: String,
      trim: true,
      maxlength: 100
    },
    relationship: {
      type: String,
      trim: true,
      maxlength: 50
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
staffSchema.index({ employmentStatus: 1 });
staffSchema.index({ courtId: 1, courtType: 1 });
staffSchema.index({ name: 1 });
staffSchema.index({ email: 1 });

// Virtual for full name (if needed for future expansion)
staffSchema.virtual('fullName').get(function() {
  return this.name;
});

// Static method to get staff by employment status
staffSchema.statics.getByStatus = function(status) {
  return this.find({ employmentStatus: status })
    .populate('courtId', 'name type')
    .sort({ name: 1 });
};

// Static method to get staff by court
staffSchema.statics.getByCourt = function(courtId, courtType = null) {
  const query = { courtId };
  if (courtType) {
    query.courtType = courtType;
  }
  
  return this.find(query)
    .populate('courtId', 'name type')
    .sort({ name: 1 });
};

// Static method to get active staff
staffSchema.statics.getActiveStaff = function() {
  return this.find({ employmentStatus: 'active' })
    .populate('courtId', 'name type')
    .sort({ name: 1 });
};

// Static method to get staff statistics
staffSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$employmentStatus',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    active: 0,
    retired: 0,
    dismissed: 0,
    on_leave: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

// Instance method to update employment status
staffSchema.methods.updateEmploymentStatus = function(newStatus, date = null) {
  this.employmentStatus = newStatus;
  
  // Clear all status-specific dates first
  this.retirementDate = undefined;
  this.dismissalDate = undefined;
  this.leaveStartDate = undefined;
  this.leaveEndDate = undefined;
  
  // Set appropriate date based on new status
  switch (newStatus) {
    case 'retired':
      this.retirementDate = date || new Date();
      break;
    case 'dismissed':
      this.dismissalDate = date || new Date();
      break;
    case 'on_leave':
      this.leaveStartDate = date || new Date();
      break;
  }
  
  return this.save();
};

// Pre-save middleware to validate employment status dates
staffSchema.pre('save', function(next) {
  // Clear inappropriate dates based on employment status
  if (this.employmentStatus !== 'retired') {
    this.retirementDate = undefined;
  }
  if (this.employmentStatus !== 'dismissed') {
    this.dismissalDate = undefined;
  }
  if (this.employmentStatus !== 'on_leave') {
    this.leaveStartDate = undefined;
    this.leaveEndDate = undefined;
  }
  
  next();
});

module.exports = mongoose.model('Staff', staffSchema);