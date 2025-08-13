const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const User = require('./models/User');
const Court = require('./models/Court');
const Staff = require('./models/Staff');

// Import routes 
let authRoutes, userRoutes, courtRoutes, staffRoutes;

// Will be set after we know if we're using database or memory store

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.REACT_APP_API_URL,
  credentials: true
}));app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB connection with fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/judiciary_staff_management';
let useDatabase = true;

mongoose.connect(MONGODB_URI, {
  //useNewUrlParser: true,
  //useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  useDatabase = true;
  // Load database routes
  authRoutes = require('./routes/auth');
  userRoutes = require('./routes/users');
  courtRoutes = require('./routes/courts');
  staffRoutes = require('./routes/staff');
  // Initialize sample data if database is empty
  initializeSampleData();
  setupRoutes();
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  console.log('Falling back to in-memory storage for development');
  useDatabase = false;
  // Initialize in-memory storage
  memoryStore = require('./data/memory-store');
  // Load simple routes
  authRoutes = require('./routes/auth-simple');
  // Make memory store available to routes
  app.locals.memoryStore = memoryStore;
  setupRoutes();
});

// Setup routes function
function setupRoutes() {
  // Routes
  app.use('/api/auth', authRoutes);
  if (useDatabase) {
    app.use('/api/users', userRoutes);
    app.use('/api/courts', courtRoutes);
    app.use('/api/staff', staffRoutes);
  }
}

// In-memory storage fallback
let memoryStore = null;

// Routes are now set up in setupRoutes() function

// Serve static files
app.get('/', (req, res) => {
  res.send('BACKEND IS RUNNING');
});

// Error handling middleware 
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
});


// Initialize sample data
async function initializeSampleData() {
  try {
    if (useDatabase) {
      
      // Check if data already exists
      const userCount = await User.countDocuments();
      if (userCount > 0) {
        console.log('Sample data already exists');
        return;
      }
      
      console.log('Initializing sample data in database...');
    } else {
      console.log('Initializing sample data in memory...');
    }
    
    // Create sample users - only admin users
    const users= [
      {
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        name: 'System Administrator'
      }
    ];
    
    const createdUsers = await User.insertMany(users);
    console.log('Sample users created');
    
    // Create sample courts - organizational units only (no login accounts)
    const courts = [
      {
        name: 'First Circuit Court',
        type: 'circuit',
        location: 'Downtown District',
                circuitCourtId: null // Will be set after circuit courts are created

      },
      {
        name: 'Second Circuit Court',
        type: 'circuit',
        location: 'North District',
        circuitCourtId: null // Will be set after circuit courts are created

  
      },
      {
        name: 'Central Magisterial Court',
        type: 'magisterial',
        location: 'Central District',
        circuitCourtId: null // Will be set after circuit courts are created
      },
      {
        name: 'East Magisterial Court',
        type: 'magisterial',
        location: 'East District',
        circuitCourtId: null // Will be set after circuit courts are created
      }
    ];
    
    const createdCourts = await Court.insertMany(courts);
    
    // Update magisterial courts with circuit court references
    await Court.updateOne(
      { name: 'Central Magisterial Court' },
      { circuitCourtId: createdCourts[0]._id }
    );
    await Court.updateOne(
      { name: 'East Magisterial Court' },
      { circuitCourtId: createdCourts[1]._id }
    );
    
    console.log('Sample courts created');
    

    
    // Create sample staff for both circuit and magisterial courts
    const staff = [
      {
        name: 'John Smith',
        position: 'Court Clerk',
        courtType: 'circuit',
        courtId: createdCourts[0]._id,
        phone: '555-0101',
        email: 'john.smith@court.gov',
        education: "Bachelor's Degree",
        employmentStatus: 'active'
      },
      {
        name: 'Sarah Johnson',
        position: 'Bailiff',
        courtType: 'circuit',
        courtId: createdCourts[0]._id,
        phone: '555-0102',
        email: 'sarah.johnson@court.gov',
        education: "Associate Degree",
        employmentStatus: 'active'
      },
      {
        name: 'Michael Brown',
        position: 'Court Reporter',
        courtType: 'circuit',
        courtId: createdCourts[1]._id,
        phone: '555-0103',
        email: 'michael.brown@court.gov',
        education: "Certificate Program",
        employmentStatus: 'active'
      },
      {
        name: 'Lisa Davis',
        position: 'Magistrate Clerk',
        courtType: 'magisterial',
        courtId: createdCourts[2]._id,
        phone: '555-0104',
        email: 'lisa.davis@court.gov',
        education: "Bachelor's Degree",
        employmentStatus: 'active'
      },
      {
        name: 'Robert Wilson',
        position: 'Security Officer',
        courtType: 'magisterial',
        courtId: createdCourts[3]._id,
        phone: '555-0105',
        email: 'robert.wilson@court.gov',
        education: "High School Diploma",
        employmentStatus: 'active'
      }
    ];
    
    await Staff.insertMany(staff);
    console.log('Sample staff created');
    console.log('Sample data initialization completed');
    
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});