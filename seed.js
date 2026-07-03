/**
 * seed.js - Populate the MongoDB database with initial HRMS data.
 * Run with: npm run seed
 */

import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';

import Employee from './models/Employee.js';
import Attendance from './models/Attendance.js';
import Leave from './models/Leave.js';
import Payroll from './models/Payroll.js';

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected for seeding...');

    // Clear existing data
    await Employee.deleteMany();
    await Attendance.deleteMany();
    await Leave.deleteMany();
    await Payroll.deleteMany();
    console.log('🗑️  Cleared existing collections');

    // Hash passwords
    const superAdminHash = await bcryptjs.hash('superadmin123', 10);
    const adminHash = await bcryptjs.hash('admin123', 10);
    const empHash = await bcryptjs.hash('employee123', 10);

    // ─── Seed Employees ───────────────────────────────────────────────────────
    const employees = await Employee.insertMany([
      {
        id: 'EMP000', name: 'Super Admin', email: 'superadmin@hrms.com',
        password: superAdminHash, role: 'Super Administrator', department: 'Management',
        joinDate: '2020-01-01', status: 'Active', salary: 0,
        phone: '+1 (555) 000-0000',
        systemRole: 'Super Admin',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=SuperAdmin'
      },
      {
        id: 'EMP001', name: 'Rajwinder Singh', email: 'admin@hrms.com',
        password: adminHash, role: 'HR Manager', department: 'Human Resources',
        joinDate: '2021-01-15', status: 'Active', salary: 120000,
        phone: '+1 (555) 123-4567',
        systemRole: 'HR Admin',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop'
      },
      {
        id: 'EMP002', name: 'Arjun Mehta', email: 'arjun@hrms.com',
        password: empHash, role: 'Senior Software Engineer', department: 'Engineering',
        joinDate: '2022-03-10', status: 'Active', salary: 110000,
        phone: '+1 (555) 234-5678',
        systemRole: 'Employee',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop'
      },
      {
        id: 'EMP003', name: 'Priya Sharma', email: 'priya@hrms.com',
        password: empHash, role: 'UI/UX Designer', department: 'Design',
        joinDate: '2022-07-05', status: 'Active', salary: 75000,
        phone: '+1 (555) 345-6789',
        systemRole: 'Employee',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&auto=format&fit=crop'
      },
      {
        id: 'EMP004', name: 'Rohan Gupta', email: 'rohan@hrms.com',
        password: empHash, role: 'Marketing Lead', department: 'Marketing',
        joinDate: '2021-11-20', status: 'On Leave', salary: 70000,
        phone: '+1 (555) 456-7890',
        systemRole: 'Employee',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop'
      },
      {
        id: 'EMP005', name: 'Sarah Connor', email: 'sarah@hrms.com',
        password: empHash, role: 'Quality Analyst', department: 'Engineering',
        joinDate: '2023-08-20', status: 'Active', salary: 65000,
        phone: '+1 (555) 876-5432',
        systemRole: 'Employee',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=256&auto=format&fit=crop'
      },
      {
        id: 'EMP006', name: 'Michael Scott', email: 'michael@hrms.com',
        password: empHash, role: 'Sales Director', department: 'Sales',
        joinDate: '2020-04-01', status: 'Active', salary: 95000,
        phone: '+1 (555) 654-3210',
        systemRole: 'Employee',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&auto=format&fit=crop'
      }
    ]);
    console.log(`👥 Seeded ${employees.length} employees`);

    // ─── Seed Attendance ─────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    await Attendance.insertMany([
      { id: 'ATT001', employeeId: 'EMP001', employeeName: 'Rajwinder Singh', date: today, checkIn: '09:05 AM', checkOut: '06:00 PM', status: 'Present', totalHours: 8.9 },
      { id: 'ATT002', employeeId: 'EMP002', employeeName: 'Arjun Mehta', date: today, checkIn: '09:45 AM', checkOut: null, status: 'Late', totalHours: 0.0 },
      { id: 'ATT003', employeeId: 'EMP003', employeeName: 'Priya Sharma', date: today, checkIn: '08:55 AM', checkOut: '05:30 PM', status: 'Present', totalHours: 8.5 },
      { id: 'ATT004', employeeId: 'EMP004', employeeName: 'Rohan Gupta', date: today, checkIn: null, checkOut: null, status: 'Absent', totalHours: 0 },
      { id: 'ATT005', employeeId: 'EMP005', employeeName: 'Sarah Connor', date: today, checkIn: '09:12 AM', checkOut: null, status: 'Present', totalHours: 0.0 },
      { id: 'ATT006', employeeId: 'EMP006', employeeName: 'Michael Scott', date: today, checkIn: '10:15 AM', checkOut: null, status: 'Late', totalHours: 0.0 }
    ]);
    console.log('📋 Seeded attendance records');

    // ─── Seed Leaves ─────────────────────────────────────────────────────────
    await Leave.insertMany([
      {
        id: 'LV001', employeeId: 'EMP004', employeeName: 'Rohan Gupta',
        leaveType: 'Medical', startDate: '2026-06-22', endDate: '2026-06-24', days: 3,
        reason: 'Severe dental surgery and recovery.', status: 'Approved', requestDate: '2026-06-20'
      },
      {
        id: 'LV002', employeeId: 'EMP003', employeeName: 'Priya Sharma',
        leaveType: 'Casual', startDate: '2026-06-26', endDate: '2026-06-26', days: 1,
        reason: "Family gathering / sister's wedding anniversary.", status: 'Pending', requestDate: '2026-06-22'
      },
      {
        id: 'LV003', employeeId: 'EMP005', employeeName: 'Sarah Connor',
        leaveType: 'Annual', startDate: '2026-07-10', endDate: '2026-07-24', days: 15,
        reason: 'Summer vacation trip overseas.', status: 'Pending', requestDate: '2026-06-18'
      },
      {
        id: 'LV004', employeeId: 'EMP002', employeeName: 'Arjun Mehta',
        leaveType: 'Casual', startDate: '2026-06-05', endDate: '2026-06-06', days: 2,
        reason: 'Moving to a new apartment.', status: 'Approved', requestDate: '2026-06-02'
      }
    ]);
    console.log('🌴 Seeded leave records');

    // ─── Seed Payroll ─────────────────────────────────────────────────────────
    await Payroll.insertMany([
      { id: 'PAY001', employeeId: 'EMP001', employeeName: 'Rajwinder Singh', month: 'June 2026', baseSalary: 120000, allowances: 6000, deductions: 3600, netPay: 122400, status: 'Pending', paymentDate: null },
      { id: 'PAY002', employeeId: 'EMP002', employeeName: 'Arjun Mehta', month: 'June 2026', baseSalary: 110000, allowances: 8000, deductions: 4500, netPay: 113500, status: 'Paid', paymentDate: '2026-06-20' },
      { id: 'PAY003', employeeId: 'EMP003', employeeName: 'Priya Sharma', month: 'June 2026', baseSalary: 75000, allowances: 4000, deductions: 2000, netPay: 77000, status: 'Pending', paymentDate: null },
      { id: 'PAY004', employeeId: 'EMP004', employeeName: 'Rohan Gupta', month: 'June 2026', baseSalary: 70000, allowances: 3000, deductions: 3500, netPay: 69500, status: 'Pending', paymentDate: null },
      { id: 'PAY005', employeeId: 'EMP005', employeeName: 'Sarah Connor', month: 'June 2026', baseSalary: 65000, allowances: 3000, deductions: 1800, netPay: 66200, status: 'Paid', paymentDate: '2026-06-20' },
      { id: 'PAY006', employeeId: 'EMP006', employeeName: 'Michael Scott', month: 'June 2026', baseSalary: 95000, allowances: 6000, deductions: 3000, netPay: 98000, status: 'Pending', paymentDate: null }
    ]);
    console.log('💰 Seeded payroll records');

    console.log('\n🎉 Database seeding complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Demo Credentials:');
    console.log('  👑 Super Admin → superadmin@hrms.com / superadmin123');
    console.log('  🔧 HR Admin    → admin@hrms.com      / admin123');
    console.log('  👤 Employee    → arjun@hrms.com      / employee123');
    console.log('  👤 Employee    → priya@hrms.com      / employee123');
    console.log('  👤 Employee    → rohan@hrms.com      / employee123');
    console.log('  👤 Employee    → sarah@hrms.com      / employee123');
    console.log('  👤 Employee    → michael@hrms.com    / employee123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seed();
