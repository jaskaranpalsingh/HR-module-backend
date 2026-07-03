import express from 'express';
import https from 'https';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// ─── Helper: calculate distance using Haversine Formula ──────────────────────
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

// ─── Helper: reverse geocode latitude & longitude into address ───────────────
async function reverseGeocode(lat, lon) {
  return new Promise((resolve) => {
    if (lat === undefined || lon === undefined || lat === null || lon === null) {
      return resolve(null);
    }
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const options = {
      headers: {
        'User-Agent': 'HRMS-App/1.0 (contact@hrms.com)'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.address) {
            const addr = parsed.address;
            const parts = [];
            
            // Build a clean, concise address (e.g. "Phase 8B, Mohali, Punjab, India")
            if (addr.suburb) parts.push(addr.suburb);
            else if (addr.neighbourhood) parts.push(addr.neighbourhood);
            else if (addr.road) parts.push(addr.road);
            else if (addr.industrial) parts.push(addr.industrial);
            
            if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
            if (addr.state) parts.push(addr.state);
            if (addr.country) parts.push(addr.country);

            resolve(parts.join(', ') || parsed.display_name);
          } else if (parsed && parsed.display_name) {
            resolve(parsed.display_name);
          } else {
            resolve(`${lat}, ${lon}`);
          }
        } catch {
          resolve(`${lat}, ${lon}`);
        }
      });
    }).on('error', (err) => {
      console.error('[Reverse Geocode] error:', err.message);
      resolve(`${lat}, ${lon}`);
    });
  });
}

// ─── Helper: generate a unique ATT id ─────────────────────────────────────────
async function generateAttId() {
  const last = await Attendance.findOne({}, {}, { sort: { id: -1 } });
  if (!last || !last.id || !last.id.startsWith('ATT')) {
    const count = await Attendance.countDocuments();
    return `ATT${String(count + 1).padStart(3, '0')}`;
  }
  const num = parseInt(last.id.replace('ATT', ''), 10);
  return `ATT${String((isNaN(num) ? 0 : num) + 1).padStart(3, '0')}`;
}

// ─── Helper: resolve the EMP-style id for a token user ────────────────────────
async function resolveEmployeeId(req) {
  const empById = await Employee.findOne({ id: req.user.id });
  if (empById) return empById.id;
  const empByEmail = await Employee.findOne({ email: req.user.email });
  if (empByEmail) return empByEmail.id;
  return req.user.id; // fallback
}

// ─── GET /api/attendance ──────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const isAdmin =
      req.user.systemRole === 'HR Admin' ||
      req.user.systemRole === 'Super Admin';

    let logs;
    if (isAdmin) {
      logs = await Attendance.find().sort({ date: -1, createdAt: -1 });
    } else {
      const empId = await resolveEmployeeId(req);
      logs = await Attendance.find({ employeeId: empId }).sort({ date: -1, createdAt: -1 });
    }

    res.json(logs);
  } catch (err) {
    console.error('[GET /attendance] error:', err.message);
    res.status(500).json({ message: 'Server error fetching attendance' });
  }
});

// ─── POST /api/attendance/punch-in ───────────────────────────────────────────
router.post('/punch-in', verifyToken, async (req, res) => {
  try {
    const isAdmin =
      req.user.systemRole === 'HR Admin' ||
      req.user.systemRole === 'Super Admin';

    const employeeId = await resolveEmployeeId(req);

    // Look up the employee record
    const emp = await Employee.findOne({ id: employeeId });
    if (!emp) {
      return res.status(404).json({ message: `Employee ${employeeId} not found` });
    }

    // Extract GPS location and device data
    const { latitude, longitude, accuracy, deviceInfo } = req.body;

    // Location permission is mandatory for employees punching in
    if (!isAdmin && (latitude === undefined || longitude === undefined || latitude === null || longitude === null)) {
      return res.status(400).json({ message: 'Location permission is required to punch in.' });
    }

    // Resolve IP address
    let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (ipAddress.includes(',')) {
      ipAddress = ipAddress.split(',')[0].trim();
    }

    // Process coordinates (Reverse Geocoding and Office Geofencing check)
    let resolvedAddress = null;
    let locationStatus = null;

    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      resolvedAddress = await reverseGeocode(latitude, longitude);

      const OFFICE_LAT = parseFloat(process.env.OFFICE_LAT) || 30.7087;
      const OFFICE_LON = parseFloat(process.env.OFFICE_LON) || 76.6889;
      const distance = getDistance(latitude, longitude, OFFICE_LAT, OFFICE_LON);
      
      locationStatus = distance <= 100 ? 'Inside Office' : 'Outside Office';
    }

    const today = new Date().toISOString().split('T')[0];
    const now   = new Date();
    const hour  = now.getHours();
    const min   = now.getMinutes();
    const isLate = hour > 9 || (hour === 9 && min > 30);
    const time   = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const punchStatus = isLate ? 'Late' : 'Present';

    // Find or create today's attendance record
    let log = await Attendance.findOne({ employeeId, date: today });

    if (log) {
      if (log.checkIn && !log.checkOut) {
        return res.json(log);
      }
      log.accumulatedHours = (log.accumulatedHours || 0) + (log.workHours || 0);
      log.checkIn    = time;
      log.checkOut   = null;
      log.status     = punchStatus;
      log.workHours  = null;
      log.totalHours = log.accumulatedHours;

      // Geolocation and device info updates
      log.latitude = latitude || null;
      log.longitude = longitude || null;
      log.accuracy = accuracy || null;
      log.address = resolvedAddress || null;
      log.ipAddress = ipAddress || null;
      log.deviceInfo = deviceInfo || null;
      log.locationStatus = locationStatus || null;

      await log.save();
    } else {
      const attId = await generateAttId();
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
        latitude:     latitude || null,
        longitude:    longitude || null,
        accuracy:     accuracy || null,
        address:      resolvedAddress || null,
        ipAddress:    ipAddress || null,
        deviceInfo:   deviceInfo || null,
        locationStatus: locationStatus || null
      });
      await log.save();
    }

    console.log(`[PUNCH-IN] ${emp.name} (${employeeId}) at ${time} — ${punchStatus} — Location: ${locationStatus} (${resolvedAddress})`);
    res.json(log);
  } catch (err) {
    console.error('[POST /attendance/punch-in] error:', err.message, err.stack);
    res.status(500).json({ message: err.message || 'Server error during punch-in' });
  }
});

// ─── POST /api/attendance/punch-out ──────────────────────────────────────────
router.post('/punch-out', verifyToken, async (req, res) => {
  try {
    const employeeId = await resolveEmployeeId(req);

    const today = new Date().toISOString().split('T')[0];
    const now   = new Date();
    const time  = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const log = await Attendance.findOne({ employeeId, date: today });

    if (!log) {
      return res.status(400).json({ message: 'No attendance record found for today — please punch in first' });
    }
    if (!log.checkIn) {
      return res.status(400).json({ message: 'Employee has not punched in yet today' });
    }
    if (log.checkOut) {
      // Already punched out — return existing record
      return res.json(log);
    }

    log.checkOut = time;

    // Calculate actual work hours — en-IN locale returns lowercase am/pm
    try {
      const parts  = log.checkIn.trim().split(' ');
      const period = (parts[1] || '').toLowerCase();
      let [h, m]   = parts[0].split(':').map(Number);
      if (period === 'pm' && h !== 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      const inDate  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
      const diffMin = Math.round((now.getTime() - inDate.getTime()) / 60000);
      const diffHrs = Math.round((diffMin / 60) * 100) / 100; // 2 decimal places
      log.workHours  = diffHrs > 0 ? diffHrs : 0;
      log.totalHours = (log.accumulatedHours || 0) + log.workHours;
    } catch {
      log.workHours  = 0;
      log.totalHours = log.accumulatedHours || 0;
    }

    await log.save();
    console.log(`[PUNCH-OUT] ${employeeId} at ${time} — ${log.workHours}h worked, total today: ${log.totalHours}h`);
    res.json(log);
  } catch (err) {
    console.error('[POST /attendance/punch-out] error:', err.message, err.stack);
    res.status(500).json({ message: err.message || 'Server error during punch-out' });
  }
});

export default router;
