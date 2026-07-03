import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from './models/Employee.js';
import Attendance from './models/Attendance.js';

dotenv.config();

async function generateAttId() {
  const last = await Attendance.findOne({}, {}, { sort: { createdAt: -1 } });
  if (!last || !last.id || !last.id.startsWith('ATT')) {
    const count = await Attendance.countDocuments();
    return `ATT${String(count + 1).padStart(3, '0')}`;
  }
  const num = parseInt(last.id.replace('ATT', ''), 10);
  return `ATT${String((isNaN(num) ? 0 : num) + 1).padStart(3, '0')}`;
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  const employeeId = 'EMP002'; // Arjun Mehta
  const emp = await Employee.findOne({ id: employeeId });
  console.log('Employee:', emp.name);

  const today = new Date().toISOString().split('T')[0];
  const now   = new Date();
  const hour  = now.getHours();
  const min   = now.getMinutes();
  const isLate = hour > 9 || (hour === 9 && min > 30);
  const time   = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const punchStatus = isLate ? 'Late' : 'Present';

  console.log('time:', time);
  console.log('punchStatus:', punchStatus);

  let log = await Attendance.findOne({ employeeId, date: today });
  console.log('Existing log for today:', log);

  if (log) {
    if (log.checkIn && !log.checkOut) {
      console.log('Already punched in. Exiting.');
      process.exit(0);
    }
    log.accumulatedHours = (log.accumulatedHours || 0) + (log.workHours || 0);
    log.checkIn    = time;
    log.checkOut   = null;
    log.status     = punchStatus;
    log.workHours  = null;
    log.totalHours = log.accumulatedHours;
    await log.save();
  } else {
    const attId = await generateAttId();
    console.log('Generated attId:', attId);
    log = new Attendance({
      id:           attId,
      employeeId,
      employeeName: emp.name,
      date:         today,
      checkIn:      time,
      checkOut:     null,
      status:       punchStatus,
      totalHours:   0,
      workHours:    null,
      accumulatedHours: 0,
    });
    await log.save();
  }
  console.log('✅ Log saved:', log);
  process.exit(0);
} catch (error) {
  console.error('❌ Error during punch-in:', error);
  process.exit(1);
}
