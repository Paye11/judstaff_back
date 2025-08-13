// In-memory data store for development when MongoDB is not available
const bcrypt = require('bcryptjs');

class MemoryStore {
  constructor() {
    this.users = [];
    this.courts = [];
    this.staff = [];
    this.nextId = 1;
    this.initializeSampleData();
  }

  generateId() {
    return this.nextId++;
  }

  async initializeSampleData() {
    // Create sample users with hashed passwords - only admin users
    const users = [
      {
        id: this.generateId(),
        username: 'admin',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
        name: 'System Administrator',
        isActive: true
      }
    ];

    this.users = users;

    // Create sample courts - organizational units only (no login accounts)
    const courts = [
      {
        id: this.generateId(),
        name: 'First Circuit Court',
        type: 'circuit',
        location: 'Downtown District',
        isActive: true
      },
      {
        id: this.generateId(),
        name: 'Second Circuit Court',
        type: 'circuit',
        location: 'North District',
        isActive: true
      },
      {
        id: this.generateId(),
        name: 'Central Magisterial Court',
        type: 'magisterial',
        location: 'Central District',
        isActive: true
      },
      {
        id: this.generateId(),
        name: 'East Magisterial Court',
        type: 'magisterial',
        location: 'East District',
        isActive: true
      }
    ];

    this.courts = courts;

    // Create sample staff for both circuit and magisterial courts
    const staff = [
      {
        id: this.generateId(),
        name: 'John Smith',
        position: 'Court Clerk',
        courtType: 'circuit',
        courtId: courts[0].id,
        phone: '555-0101',
        email: 'john.smith@court.gov',
        education: "Bachelor's Degree",
        employmentStatus: 'active',
        createdAt: new Date('2024-01-15T10:00:00.000Z')
      },
      {
        id: this.generateId(),
        name: 'Sarah Johnson',
        position: 'Bailiff',
        courtType: 'circuit',
        courtId: courts[0].id,
        phone: '555-0102',
        email: 'sarah.johnson@court.gov',
        education: "Associate Degree",
        employmentStatus: 'active',
        createdAt: new Date('2024-01-20T14:30:00.000Z')
      },
      {
        id: this.generateId(),
        name: 'Michael Brown',
        position: 'Court Reporter',
        courtType: 'circuit',
        courtId: courts[1].id,
        phone: '555-0103',
        email: 'michael.brown@court.gov',
        education: "Certificate Program",
        employmentStatus: 'active',
        createdAt: new Date('2024-02-01T09:00:00.000Z')
      },
      {
        id: this.generateId(),
        name: 'Lisa Davis',
        position: 'Magistrate Clerk',
        courtType: 'magisterial',
        courtId: courts[2].id,
        phone: '555-0104',
        email: 'lisa.davis@court.gov',
        education: "Bachelor's Degree",
        employmentStatus: 'active',
        createdAt: new Date('2024-02-05T11:00:00.000Z')
      },
      {
        id: this.generateId(),
        name: 'Robert Wilson',
        position: 'Security Officer',
        courtType: 'magisterial',
        courtId: courts[3].id,
        phone: '555-0105',
        email: 'robert.wilson@court.gov',
        education: "High School Diploma",
        employmentStatus: 'active',
        createdAt: new Date('2024-02-10T08:30:00.000Z')
      }
    ];

    this.staff = staff;
    console.log('In-memory sample data initialized');
  }

  // User methods
  async findUserByUsername(username) {
    return this.users.find(user => user.username.toLowerCase() === username.toLowerCase());
  }

  async findUserById(id) {
    return this.users.find(user => user.id == id);
  }

  async getAllUsers() {
    return this.users;
  }

  async createUser(userData) {
    const user = {
      id: this.generateId(),
      ...userData,
      password: await bcrypt.hash(userData.password, 10),
      isActive: true
    };
    this.users.push(user);
    return user;
  }

  // Court methods
  async getAllCourts() {
    return this.courts;
  }

  async getCourtsByType(type) {
    return this.courts.filter(court => court.type === type);
  }

  async findCourtById(id) {
    return this.courts.find(court => court.id == id);
  }

  async createCourt(courtData) {
    const court = {
      id: this.generateId(),
      ...courtData,
      isActive: true
    };
    this.courts.push(court);
    return court;
  }

  // Staff methods
  async getAllStaff() {
    return this.staff;
  }

  async getStaffByStatus(status) {
    return this.staff.filter(staff => staff.employmentStatus === status);
  }

  async getStaffByCourt(courtId) {
    return this.staff.filter(staff => staff.courtId == courtId);
  }

  async findStaffById(id) {
    return this.staff.find(staff => staff.id == id);
  }

  async createStaff(staffData) {
    const staff = {
      id: this.generateId(),
      ...staffData,
      createdAt: new Date()
    };
    this.staff.push(staff);
    return staff;
  }

  async updateStaff(id, updateData) {
    const index = this.staff.findIndex(staff => staff.id == id);
    if (index !== -1) {
      this.staff[index] = { ...this.staff[index], ...updateData, updatedAt: new Date() };
      return this.staff[index];
    }
    return null;
  }

  async deleteStaff(id) {
    const index = this.staff.findIndex(staff => staff.id == id);
    if (index !== -1) {
      return this.staff.splice(index, 1)[0];
    }
    return null;
  }
}

module.exports = new MemoryStore();