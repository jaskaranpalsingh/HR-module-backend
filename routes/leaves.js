import express from 'express';
import Leave from '../models/Leave.js';
import Employee from '../models/Employee.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/leaves
// @desc    Get all leave requests (filtered to personal logs for Employees)
router.get('/', verifyToken, async (req, res) => {
  try {
    const isHR = req.user.systemRole === 'HR Admin' || req.user.systemRole === 'Super Admin';
    let logs;

    if (isHR) {
      logs = await Leave.find().sort({ requestDate: -1, createdAt: -1 });
    } else {
      logs = await Leave.find({ employeeId: req.user.id }).sort({ requestDate: -1, createdAt: -1 });
    }

    res.json(logs);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/leaves
// @desc    Submit a leave request
router.post('/', verifyToken, async (req, res) => {
  const { leaveType, startDate, endDate, reason, days } = req.body;
  const isHR = req.user.systemRole === 'HR Admin' || req.user.systemRole === 'Super Admin';
  const employeeId = isHR && req.body.employeeId ? req.body.employeeId : req.user.id;

  // TEMP DEBUG — remove once issue is found
  console.log('req.user:', req.user);
  console.log('employeeId being searched:', employeeId);

  try {
    const emp = await Employee.findOne({ id: employeeId });

    // TEMP DEBUG — remove once issue is found
    console.log('employee found:', emp);

    if (!emp) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const count = await Leave.countDocuments();
    const leaveId = `LV${String(count + 1).padStart(3, '0')}`;

    const newLeave = new Leave({
      id: leaveId,
      employeeId,
      employeeName: emp.name,
      leaveType,
      startDate,
      endDate,
      days: Number(days),
      reason,
      status: 'Pending',
      requestDate: new Date().toISOString().split('T')[0]
    });

    await newLeave.save();
    res.status(201).json(newLeave);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/leaves/:id/status
// @desc    Update leave request status (admin only)
router.put('/:id/status', [verifyToken, requireAdmin], async (req, res) => {
  const { status } = req.body;

  if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const leave = await Leave.findOne({ id: req.params.id });
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    leave.status = status;
    await leave.save();

    // Cascading updates on employee status
    const emp = await Employee.findOne({ id: leave.employeeId });
    if (emp) {
      if (status === 'Approved') {
        emp.status = 'On Leave';
      } else {
        emp.status = 'Active';
      }
      await emp.save();
    }

    res.json(leave);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;