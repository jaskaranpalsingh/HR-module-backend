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
    enum: ['Present', 'Late', 'Absent'],
    default: 'Absent'
  },
  totalHours: {
    type: Number,
    default: 0
  },
  workHours: {
    type: Number,
    default: null
  },
  accumulatedHours: {
    type: Number,
    default: 0
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  accuracy: {
    type: Number,
    default: null
  },
  address: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  deviceInfo: {
    type: String,
    default: null
  },
  locationStatus: {
    type: String,
    enum: ['Inside Office', 'Outside Office', null],
    default: null
  }
}, {
  timestamps: true
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
