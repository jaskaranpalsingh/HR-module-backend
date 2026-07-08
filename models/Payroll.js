import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  employeeId: {
    type: String,
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  department: {
    type: String,
    default: ''
  },
  month: {
    type: String,
    required: true
  },
  // Salary fields
  baseSalary: {
    type: Number,
    required: true
  },
  totalDaysInMonth: {
    type: Number,
    default: 30
  },
  workingDays: {
    type: Number,
    default: 0
  },
  paidLeaves: {
    type: Number,
    default: 0
  },
  unpaidLeaves: {
    type: Number,
    default: 0
  },
  perDaySalary: {
    type: Number,
    default: 0
  },
  leaveDeduction: {
    type: Number,
    default: 0
  },
  // allowances = bonus / HRA / travel etc.
  allowances: {
    type: Number,
    default: 0
  },
  // Other manual deductions (taxes, insurance, etc.)
  deductions: {
    type: Number,
    default: 0
  },
  netPay: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  },
  paymentDate: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const Payroll = mongoose.model('Payroll', payrollSchema);

export default Payroll;
