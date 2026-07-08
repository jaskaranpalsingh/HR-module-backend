import express from 'express';
import Payroll from '../models/Payroll.js';
import Leave from '../models/Leave.js';
import Employee from '../models/Employee.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ─── Helper: get days in a month string like "June 2026" ─────────────────────
function getDaysInMonth(monthStr) {
  try {
    const date = new Date(`${monthStr} 01`);
    if (isNaN(date.getTime())) return 30;
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    return new Date(year, month + 1, 0).getDate();
  } catch {
    return 30;
  }
}

// ─── Helper: count approved unpaid leaves for an employee in a given month ───
async function countUnpaidLeaves(employeeId, monthStr) {
  try {
    const date = new Date(`${monthStr} 01`);
    if (isNaN(date.getTime())) return 0;
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay  = new Date(year, month + 1, 0).toISOString().split('T')[0];

    // Fetch all approved leaves for this employee that overlap the month
    const approvedLeaves = await Leave.find({
      employeeId,
      status: 'Approved',
      $or: [
        { startDate: { $gte: firstDay, $lte: lastDay } },
        { endDate:   { $gte: firstDay, $lte: lastDay } },
        { startDate: { $lte: firstDay }, endDate: { $gte: lastDay } }
      ]
    });

    // Sum up leave days (clipped to the month boundary)
    let totalUnpaid = 0;
    for (const leave of approvedLeaves) {
      const start = new Date(Math.max(new Date(leave.startDate), new Date(firstDay)));
      const end   = new Date(Math.min(new Date(leave.endDate),   new Date(lastDay)));
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0) totalUnpaid += diffDays;
    }
    return totalUnpaid;
  } catch {
    return 0;
  }
}

// @route   GET /api/payroll
// @desc    Get all payroll records (filtered to personal records for Employees)
router.get('/', verifyToken, async (req, res) => {
  try {
    const isHR = req.user.systemRole === 'HR Admin' || req.user.systemRole === 'Super Admin';
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

// @route   GET /api/payroll/unpaid-leaves
// @desc    Get unpaid leave count for an employee in a given month
// @query   employeeId, month
router.get('/unpaid-leaves', [verifyToken, requireAdmin], async (req, res) => {
  const { employeeId, month } = req.query;

  if (!employeeId || !month) {
    return res.status(400).json({ message: 'employeeId and month are required.' });
  }

  try {
    const unpaidLeaves = await countUnpaidLeaves(employeeId, month);
    const totalDaysInMonth = getDaysInMonth(month);
    res.json({ unpaidLeaves, totalDaysInMonth });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll
// @desc    Create a new payroll record (HR Admin / Super Admin only)
router.post('/', [verifyToken, requireAdmin], async (req, res) => {
  const {
    employeeId,
    employeeName,
    month,
    baseSalary,
    allowances,
    deductions,
    // Optional overrides — if not provided, auto-calculated
    unpaidLeaves: manualUnpaidLeaves,
    paidLeaves,
    workingDays,
  } = req.body;

  if (!employeeId || !employeeName || !month || !baseSalary) {
    return res.status(400).json({ message: 'employeeId, employeeName, month and baseSalary are required.' });
  }

  try {
    // ── Look up employee for department ──────────────────────────────────────
    const emp = await Employee.findOne({ id: employeeId });
    const department = emp?.department || '';

    // ── Figure out month days ─────────────────────────────────────────────────
    const totalDaysInMonth = getDaysInMonth(month);

    // ── Count unpaid leaves (auto from DB, or use manual override) ───────────
    const unpaidLeaves = manualUnpaidLeaves !== undefined
      ? Number(manualUnpaidLeaves)
      : await countUnpaidLeaves(employeeId, month);

    // ── Salary math ──────────────────────────────────────────────────────────
    const perDaySalary   = Number(baseSalary) / totalDaysInMonth;
    const leaveDeduction = perDaySalary * unpaidLeaves;
    const netPay         = Number(baseSalary) - leaveDeduction + Number(allowances || 0) - Number(deductions || 0);

    const uniqueId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const payroll = new Payroll({
      id: uniqueId,
      employeeId,
      employeeName,
      department,
      month,
      baseSalary:      Number(baseSalary),
      totalDaysInMonth,
      workingDays:     workingDays !== undefined ? Number(workingDays) : totalDaysInMonth - unpaidLeaves,
      paidLeaves:      Number(paidLeaves || 0),
      unpaidLeaves,
      perDaySalary:    Math.round(perDaySalary * 100) / 100,
      leaveDeduction:  Math.round(leaveDeduction * 100) / 100,
      allowances:      Number(allowances || 0),
      deductions:      Number(deductions || 0),
      netPay:          Math.round(netPay * 100) / 100,
      status:          'Pending',
    });

    await payroll.save();
    res.status(201).json(payroll);
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
