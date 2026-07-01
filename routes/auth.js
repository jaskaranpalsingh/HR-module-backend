import express from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';
import { verifyToken, requireSuperAdmin, JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide both email and password' });
  }

  try {
    const employee = await Employee.findOne({
      $or: [
        { email: email.toLowerCase() },
        { officialEmail: email.toLowerCase() },
        { id: email.toUpperCase() }
      ]
    });

    if (!employee) {
      return res.status(404).json({ message: 'User not found. Ensure HR has created this employee account first.' });
    }

    const isMatch = await bcryptjs.compare(password, employee.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    // Use systemRole stored in DB — the source of truth
    const systemRole = employee.systemRole || 'Employee';

    // Sign Token — embed systemRole
    const payload = {
      id: employee.id,
      email: employee.email,
      name: employee.name,
      systemRole: systemRole
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          success: true,
          token,
          user: {
            email: employee.email,
            name: employee.name,
            systemRole: systemRole,
            avatar: employee.avatar
          }
        });
      }
    );
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/signup
// @desc    Register a new HR Admin (Super Admin only)
router.post('/signup', [verifyToken, requireSuperAdmin], async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  if (!name || !email || !password || !phone) {
    return res.status(400).json({ message: 'Please provide all required fields' });
  }

  try {
    const existingEmployee = await Employee.findOne({ email: email.toLowerCase() });
    if (existingEmployee) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    // Generate unique EMP ID
    const lastEmp = await Employee.findOne({}, {}, { sort: { id: -1 } });
    let nextId = 'EMP007';
    if (lastEmp && lastEmp.id && lastEmp.id.startsWith('EMP')) {
      const num = parseInt(lastEmp.id.replace('EMP', ''), 10);
      if (!isNaN(num)) {
        nextId = `EMP${String(num + 1).padStart(3, '0')}`;
      }
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const newEmployee = new Employee({
      id: nextId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'HR Administrator',
      department: 'Human Resources',
      joinDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      salary: 90000,
      phone,
      systemRole: 'HR Admin',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
    });

    await newEmployee.save();

    res.status(201).json({
      success: true,
      message: `HR Admin account created for ${name}`,
      user: {
        id: newEmployee.id,
        name: newEmployee.name,
        email: newEmployee.email,
        systemRole: 'HR Admin'
      }
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/assign-hr
// @desc    Promote an employee to HR Admin or demote back to Employee (Super Admin only)
router.post('/assign-hr', [verifyToken, requireSuperAdmin], async (req, res) => {
  const { employeeId, action } = req.body;
  // action: 'promote' | 'demote'

  if (!employeeId || !action) {
    return res.status(400).json({ message: 'employeeId and action (promote/demote) are required' });
  }

  if (!['promote', 'demote'].includes(action)) {
    return res.status(400).json({ message: 'action must be "promote" or "demote"' });
  }

  try {
    const employee = await Employee.findOne({ id: employeeId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Protect Super Admin accounts from being demoted
    if (employee.systemRole === 'Super Admin') {
      return res.status(403).json({ message: 'Cannot modify Super Admin account.' });
    }

    employee.systemRole = action === 'promote' ? 'HR Admin' : 'Employee';
    await employee.save();

    res.json({
      success: true,
      message: `${employee.name} has been ${action === 'promote' ? 'promoted to HR Admin' : 'demoted to Employee'}.`,
      employee: {
        id: employee.id,
        name: employee.name,
        systemRole: employee.systemRole
      }
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user session context
router.get('/me', verifyToken, async (req, res) => {
  try {
    const employee = await Employee.findOne({ id: req.user.id });
    if (!employee) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    res.json({
      email: employee.email,
      name: employee.name,
      systemRole: employee.systemRole || 'Employee',
      avatar: employee.avatar
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;