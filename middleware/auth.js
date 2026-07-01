import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Fail fast on startup if JWT_SECRET isn't set — no insecure fallback.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is not set. Add it to your .env file before starting the server.'
  );
}

export { JWT_SECRET };

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authentication token provided. Access denied.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token. Access denied.' });
  }
};

// Allows both HR Admin and Super Admin
export const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.systemRole !== 'HR Admin' && req.user.systemRole !== 'Super Admin')) {
    return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
  }
  next();
};

// Only Super Admin can access
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.systemRole !== 'Super Admin') {
    return res.status(403).json({ message: 'Access denied. Super Administrator privileges required.' });
  }
  next();
};