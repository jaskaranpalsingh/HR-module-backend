import express from 'express';
import Payroll from '../models/Payroll.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/payroll
// @desc    Get all payroll records (filtered to personal records for Employees)
router.get('/', verifyToken, async (req, res) => {
  try {
    const isHR = req.user.role === 'HR Admin';
    let records;

    if (isHR) {
      records = await Payroll.find().sort({ createdAt: -1 });
    } else {
      records = await Payroll.find({ employeeId: req.user.id }).sort({ createdAt: -1 });
    }

    res.json(records);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/payroll/:id/status
// @desc    Mark payroll as paid (admin only)
router.put('/:id/status', [verifyToken, requireAdmin], async (req, res) => {
  const { status } = req.body;

  if (!['Pending', 'Paid'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const payroll = await Payroll.findOne({ id: req.params.id });
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    payroll.status = status;
    payroll.paymentDate = status === 'Paid'
      ? new Date().toISOString().split('T')[0]
      : null;

    await payroll.save();
    res.json(payroll);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
