import express from 'express';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/attendance
// @desc    Get all attendance logs (filtered to personal logs for Employees)
router.get('/', verifyToken, async (req, res) => {
  try {
    const isHR = req.user.role === 'HR Admin';
    let logs;

    if (isHR) {
      logs = await Attendance.find().sort({ date: -1, createdAt: -1 });
    } else {
      logs = await Attendance.find({ employeeId: req.user.id }).sort({ date: -1, createdAt: -1 });
    }

    res.json(logs);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/attendance/punch-in
// @desc    Punch in today
router.post('/punch-in', verifyToken, async (req, res) => {
  // If employee, they can only punch in themselves
  const employeeId = req.user.role === 'HR Admin' ? req.body.employeeId : req.user.id;
  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  try {
    const emp = await Employee.findOne({ id: employeeId });
    if (!emp) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    let log = await Attendance.findOne({ employeeId, date: today });

    if (log) {
      // If log exists, update checkIn if it was empty
      if (!log.checkIn) {
        log.checkIn = time;
        log.status = log.status === 'Absent' ? 'On Time' : log.status;
        await log.save();
      }
    } else {
      // Create new
      const count = await Attendance.countDocuments();
      const attId = `ATT${String(count + 1).padStart(3, '0')}`;
      
      log = new Attendance({
        id: attId,
        employeeId,
        employeeName: emp.name,
        date: today,
        checkIn: time,
        status: 'On Time',
        totalHours: 0
      });
      await log.save();
    }

    res.json(log);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/attendance/punch-out
// @desc    Punch out today
router.post('/punch-out', verifyToken, async (req, res) => {
  // If employee, they can only punch out themselves
  const employeeId = req.user.role === 'HR Admin' ? req.body.employeeId : req.user.id;
  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  try {
    const log = await Attendance.findOne({ employeeId, date: today });

    if (!log) {
      return res.status(400).json({ message: 'No punch-in log found for today' });
    }

    if (!log.checkOut) {
      log.checkOut = time;
      log.totalHours = 8.5; // Mock daily duration
      await log.save();
    }

    res.json(log);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
