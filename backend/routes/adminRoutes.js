// routes/adminRoutes.js
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const {
  adminLogin, getDashboardStats,
  getAllDrivers, getDriverDetail, approveDriver, rejectDriver, suspendDriver, deleteDriver,
  getAllPassengers, freezePassenger, deletePassenger,
  getAllRides, changeAdminPassword, getActivity,
  getPendingSubscriptions, reviewSubscription
} = require('../controllers/adminController');

// ── Admin JWT middleware ───────────────────────────────────────────────────────
// Reads Authorization: Bearer <token>, verifies role === 'admin'
// Does NOT use the passenger/driver 'protect' middleware — admin tokens are separate
const requireAdmin = (req, res, next) => {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    return res.status(401).json({ success: false, message: 'Admin token required.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised as admin.' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token.' });
  }
};

// ── POST /api/admin/verify  (public — no token needed) ───────────────────────
// Admin dashboard calls this with the password → returns signed admin JWT
router.post('/verify', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ success: false, message: 'ADMIN_PASSWORD not set on server.' });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ success: false, message: 'Incorrect admin password.' });
  }
  const token = jwt.sign(
    { role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  return res.json({ success: true, token });
});

// ── POST /api/admin/login  (kept for backward compatibility) ──────────────────
router.post('/login', adminLogin);

// ── All routes below this line require a valid admin JWT ──────────────────────
router.use(requireAdmin);

router.get('/stats',    getDashboardStats);
router.get('/activity', getActivity);

// Drivers
router.get('/drivers',                    getAllDrivers);
router.get('/drivers/:id',                getDriverDetail);
router.put('/drivers/:id/approve',        approveDriver);
router.put('/drivers/:id/reject',         rejectDriver);
router.put('/drivers/:id/suspend',        suspendDriver);
router.put('/drivers/:id/subscription',   reviewSubscription);
router.delete('/drivers/:id',             deleteDriver);

// Passengers
router.get('/passengers',              getAllPassengers);
router.put('/passengers/:id/freeze',   freezePassenger);
router.delete('/passengers/:id',       deletePassenger);

// Rides
router.get('/rides', getAllRides);

// Subscriptions
router.get('/subscriptions/pending', getPendingSubscriptions);

// Settings
router.put('/change-password', changeAdminPassword);

module.exports = router;