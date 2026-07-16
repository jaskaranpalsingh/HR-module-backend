import express from 'express';
import bcryptjs from 'bcryptjs';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Payroll from '../models/Payroll.js';
import { verifyToken, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/employees
// @desc    Get all employees (role-based salary masking)
router.get('/', verifyToken, async (req, res) => {
  try {
    const isHR = req.user.systemRole === 'HR Admin' || req.user.systemRole === 'Super Admin';
    const employees = await Employee.find().sort({ createdAt: -1 });

    if (!isHR) {
      // Employees cannot see coworkers' salaries or passwords
      const sanitized = employees.map(emp => {
        const obj = emp.toObject();
        delete obj.salary;
        delete obj.password;
        return obj;
      });
      return res.json(sanitized);
    }

    res.json(employees);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/employees
// @desc    Create a new employee (admin only)
router.post('/', [verifyToken, requireAdmin], async (req, res) => {
  const {
    name,
    email,
    role,
    department,
    joinDate,
    salary,
    phone,
    avatar,
    password,
    firstName,
    lastName,
    officialEmail,
    uanNumber,
    aadhaarNumber,
    panNumber
  } = req.body;

  try {
    // Check if email already exists
    const existing = await Employee.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    // Generate unique EMP ID — find the highest existing ID and increment
    const lastEmp = await Employee.findOne({}, {}, { sort: { id: -1 } });
    let nextNum = 1;
    if (lastEmp && lastEmp.id && lastEmp.id.startsWith('EMP')) {
      const num = parseInt(lastEmp.id.replace('EMP', ''), 10);
      if (!isNaN(num)) {
        nextNum = num + 1;
      }
    }
    const employeeId = `EMP${String(nextNum).padStart(3, '0')}`;

    // Hash password (default to 'employee123' if not provided)
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password || 'employee123', salt);

    const displayName = name || `${firstName || ''} ${lastName || ''}`.trim() || 'New Employee';

    const newEmp = new Employee({
      id: employeeId,
      name: displayName,
      email,
      password: hashedPassword,
      role: role || 'Employee',
      department: department || 'Engineering',
      joinDate: joinDate || new Date().toISOString().split('T')[0],
      salary: Number(salary) || 50000,
      phone,
      avatar: avatar || undefined,
      firstName,
      lastName,
      officialEmail,
      uanNumber,
      aadhaarNumber,
      panNumber
    });

    await newEmp.save();

    // Auto-create Payroll entry — find the highest existing ID and increment
    const lastPayroll = await Payroll.findOne({}, {}, { sort: { id: -1 } });
    let nextPayNum = 1;
    if (lastPayroll && lastPayroll.id && lastPayroll.id.startsWith('PAY')) {
      const num = parseInt(lastPayroll.id.replace('PAY', ''), 10);
      if (!isNaN(num)) {
        nextPayNum = num + 1;
      }
    }
    const payrollId = `PAY${String(nextPayNum).padStart(3, '0')}`;

    const newPayroll = new Payroll({
      id: payrollId,
      employeeId: newEmp.id,
      employeeName: newEmp.name,
      month: 'June 2026',
      baseSalary: newEmp.salary,
      allowances: Math.round(newEmp.salary * 0.05),
      deductions: Math.round(newEmp.salary * 0.03),
      netPay: Math.round(newEmp.salary * 1.02),
      status: 'Pending'
    });
    await newPayroll.save();

    // Auto-create Attendance entry — find the highest existing ID and increment
    const lastAttendance = await Attendance.findOne({}, {}, { sort: { id: -1 } });
    let nextAttNum = 1;
    if (lastAttendance && lastAttendance.id && lastAttendance.id.startsWith('ATT')) {
      const num = parseInt(lastAttendance.id.replace('ATT', ''), 10);
      if (!isNaN(num)) {
        nextAttNum = num + 1;
      }
    }
    const attId = `ATT${String(nextAttNum).padStart(3, '0')}`;

    const newAttendance = new Attendance({
      id: attId,
      employeeId: newEmp.id,
      employeeName: newEmp.name,
      date: new Date().toISOString().split('T')[0],
      checkIn: null,
      checkOut: null,
      status: 'Absent',
      totalHours: 0
    });
    await newAttendance.save();

    res.status(201).json(newEmp);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/employees/:id
// @desc    Update an employee (admin only)
router.put('/:id', [verifyToken, requireAdmin], async (req, res) => {
  try {
    const employee = await Employee.findOne({ id: req.params.id });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (employee.systemRole === 'Super Admin' && req.user.systemRole !== 'Super Admin') {
      return res.status(403).json({ message: 'HR Admin cannot modify a Super Admin' });
    }

    const {
      name,
      email,
      role,
      department,
      joinDate,
      salary,
      phone,
      avatar,
      status,
      firstName,
      lastName,
      officialEmail,
      uanNumber,
      aadhaarNumber,
      panNumber,
      uanDoc,
      aadhaarDoc,
      panDoc,
      newPassword
      // NOTE: systemRole is intentionally excluded — use /api/auth/assign-hr instead
    } = req.body;

    if (firstName) employee.firstName = firstName;
    if (lastName) employee.lastName = lastName;
    if (officialEmail) employee.officialEmail = officialEmail;
    if (uanNumber !== undefined) employee.uanNumber = uanNumber;
    if (aadhaarNumber !== undefined) employee.aadhaarNumber = aadhaarNumber;
    if (panNumber !== undefined) employee.panNumber = panNumber;
    if (uanDoc !== undefined) employee.uanDoc = uanDoc;
    if (aadhaarDoc !== undefined) employee.aadhaarDoc = aadhaarDoc;
    if (panDoc !== undefined) employee.panDoc = panDoc;

    if (firstName || lastName) {
      employee.name = `${firstName || employee.firstName || ''} ${lastName || employee.lastName || ''}`.trim();
    } else if (name) {
      employee.name = name;
    }

    if (email) employee.email = email;
    if (role) employee.role = role;
    if (department) employee.department = department;
    if (joinDate) employee.joinDate = joinDate;
    if (salary) employee.salary = Number(salary);
    if (phone) employee.phone = phone;
    if (avatar) employee.avatar = avatar;
    if (status) employee.status = status;

    // ── Change password if provided ──
    if (newPassword && newPassword.trim().length >= 6) {
      const salt = await bcryptjs.genSalt(10);
      employee.password = await bcryptjs.hash(newPassword.trim(), salt);
    }

    await employee.save();

    // Cascade update employeeName across other collections if name changed
    await Attendance.updateMany({ employeeId: employee.id }, { employeeName: employee.name });
    await Payroll.updateMany({ employeeId: employee.id }, { employeeName: employee.name });

    res.json(employee);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});


// @route   DELETE /api/employees/:id
// @desc    Delete an employee (admin only)
router.delete('/:id', [verifyToken, requireAdmin], async (req, res) => {
  try {
    const empToCheck = await Employee.findOne({ id: req.params.id });
    if (!empToCheck) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    if (empToCheck.systemRole === 'Super Admin' && req.user.systemRole !== 'Super Admin') {
      return res.status(403).json({ message: 'HR Admin cannot delete a Super Admin' });
    }

    const employee = await Employee.findOneAndDelete({ id: req.params.id });

    // Cascade delete associated payroll and attendance records
    await Payroll.deleteMany({ employeeId: req.params.id });
    await Attendance.deleteMany({ employeeId: req.params.id });

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;