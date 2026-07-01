import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
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
  date: {
    type: String,
    required: true
  },
  checkIn: {
    type: String,
    default: null
  },
  checkOut: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['On Time', 'Late', 'Absent', 'Present'],
    default: 'Absent'
  },
  totalHours: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
