// middleware/auth.js — JWT Authentication (supports passenger, driver, admin)
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const Driver = require('../models/Driver');
const Admin  = require('../models/Admin');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized. Please login first.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'admin') {
      req.user = await Admin.findById(decoded.id).select('-password');
    } else if (decoded.role === 'driver') {
      req.user = await Driver.findById(decoded.id).select('-password');
    } else {
      req.user = await User.findById(decoded.id).select('-password');
    }

    if (!req.user) return res.status(401).json({ message: 'Account not found.' });

    // Check if passenger is frozen
    if (decoded.role === 'passenger' && req.user.isFrozen) {
      return res.status(403).json({ message: 'Your account has been frozen. Please contact support.' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalid or expired. Please login again.' });
  }
};

const driverOnly = (req, res, next) => {
  if (req.user && req.user.role === 'driver') return next();
  res.status(403).json({ message: 'Access denied. Drivers only.' });
};

const passengerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'passenger') return next();
  res.status(403).json({ message: 'Access denied. Passengers only.' });
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ message: 'Access denied. Admin only.' });
};

module.exports = { protect, driverOnly, passengerOnly, adminOnly };
