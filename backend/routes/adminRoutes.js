// routes/adminRoutes.js
const express = require('express');
const router  = express.Router();
const {
  adminLogin, getDashboardStats,
  getAllDrivers, getDriverDetail, approveDriver, rejectDriver, suspendDriver, deleteDriver,
  getAllPassengers, freezePassenger, deletePassenger,
  getAllRides, changeAdminPassword, getActivity,
  getPendingSubscriptions, reviewSubscription
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ message: 'Admin access only.' });
};

// Public
router.post('/login', adminLogin);

// Protected (must be logged in as admin)
router.use(protect, adminOnly);

router.get('/stats',    getDashboardStats);
router.get('/activity', getActivity);

// Drivers
router.get('/drivers',                    getAllDrivers);
router.get('/drivers/:id',                getDriverDetail);
router.put('/drivers/:id/approve',        approveDriver);
router.put('/drivers/:id/reject',         rejectDriver);
router.put('/drivers/:id/suspend',        suspendDriver);
router.delete('/drivers/:id',             deleteDriver);

// Subscriptions
router.get('/subscriptions/pending',      getPendingSubscriptions);
router.put('/drivers/:id/subscription',   reviewSubscription);

// Passengers
router.get('/passengers',                 getAllPassengers);
router.put('/passengers/:id/freeze',      freezePassenger);
router.delete('/passengers/:id',          deletePassenger);

// Rides
router.get('/rides', getAllRides);

// Settings
router.put('/change-password', changeAdminPassword);

module.exports = router;
