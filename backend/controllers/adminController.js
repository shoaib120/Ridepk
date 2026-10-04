// controllers/adminController.js
// Full admin: stats, driver approval, user freeze, ride overview, settings, subscriptions

const Admin  = require('../models/Admin');
const Driver = require('../models/Driver');
const User   = require('../models/User');
const Ride   = require('../models/Ride');
const jwt    = require('jsonwebtoken');
const {
  sendDriverSubscriptionResult,
  sendDriverApprovalEmail,
  sendDriverRejectionEmail
} = require('../config/mailer');

const generateToken = (id) =>
  jwt.sign({ id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });

// =====================
//  ADMIN LOGIN
// =====================
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password are required.' });

    const admin = await Admin.findOne({ username });
    if (!admin)
      return res.status(401).json({ message: 'Invalid admin credentials.' });

    const isMatch = await admin.matchPassword(password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid admin credentials.' });

    admin.lastLogin = new Date();
    await admin.save();

    res.json({
      success: true,
      token: generateToken(admin._id),
      admin: { id: admin._id, username: admin.username, email: admin.email, role: 'admin' }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  DASHBOARD STATS
// =====================
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalPassengers, totalDrivers, pendingDrivers, approvedDrivers,
      frozenPassengers, frozenDrivers, totalRides, todayRides,
      completedRides, totalRevenue
    ] = await Promise.all([
      User.countDocuments({}),
      Driver.countDocuments({}),
      Driver.countDocuments({ status: 'pending' }),
      Driver.countDocuments({ status: 'approved' }),
      User.countDocuments({ isFrozen: true }),
      Driver.countDocuments({ status: 'suspended' }),
      Ride.countDocuments({}),
      Ride.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      Ride.countDocuments({ status: 'completed' }),
      Ride.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$finalPrice' } } }
      ])
    ]);

    const onlineDrivers = await Driver.countDocuments({ isOnline: true, status: 'approved' });

    const pendingSubscriptions = await Driver.countDocuments({
      status: 'approved',
      'subscription.paymentStatus': 'pending'
    });

    res.json({
      success: true,
      stats: {
        totalPassengers, totalDrivers, pendingDrivers, approvedDrivers,
        frozenPassengers, frozenDrivers, totalRides, todayRides,
        completedRides, totalRevenue: totalRevenue[0]?.total || 0,
        onlineDrivers, pendingSubscriptions
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  GET ALL DRIVERS
// =====================
const getAllDrivers = async (req, res) => {
  try {
    const { status, page = 1, search = '' } = req.query;
    const limit = 20;
    const skip  = (parseInt(page) - 1) * limit;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone:    { $regex: search, $options: 'i' } },
        { city:     { $regex: search, $options: 'i' } }
      ];
    }

    const [drivers, total] = await Promise.all([
      Driver.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Driver.countDocuments(query)
    ]);

    res.json({ success: true, drivers, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  GET SINGLE DRIVER DETAIL
// =====================
const getDriverDetail = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).select('-password');
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });
    const rides = await Ride.find({ driver: driver._id })
      .sort({ createdAt: -1 }).limit(10).populate('passenger', 'name phone');
    res.json({ success: true, driver, recentRides: rides });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  APPROVE DRIVER
// =====================
const approveDriver = async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id, { status: 'approved' }, { new: true }
    );
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    // Send approval email to driver
    sendDriverApprovalEmail(driver).catch(() => {});

    res.json({ success: true, message: `${driver.fullName} has been approved.`, driver });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  REJECT DRIVER
// =====================
const rejectDriver = async (req, res) => {
  try {
    const { reason } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', rejectionReason: reason || 'Application rejected by admin.' },
      { new: true }
    );
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    // Send rejection email to driver
    sendDriverRejectionEmail(driver, reason || 'Application rejected by admin.').catch(() => {});

    res.json({ success: true, message: `${driver.fullName} has been rejected.`, driver });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  SUSPEND / UNSUSPEND DRIVER
// =====================
const suspendDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    const isSuspended = driver.status === 'suspended';
    driver.status   = isSuspended ? 'approved' : 'suspended';
    driver.isOnline = false;
    await driver.save();

    res.json({
      success: true,
      message: isSuspended
        ? `${driver.fullName} account reinstated.`
        : `${driver.fullName} account suspended.`,
      driver
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  DELETE DRIVER
// =====================
const deleteDriver = async (req, res) => {
  try {
    await Driver.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Driver deleted permanently.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  GET ALL PASSENGERS
// =====================
const getAllPassengers = async (req, res) => {
  try {
    const { page = 1, search = '', status } = req.query;
    const limit = 20;
    const skip  = (parseInt(page) - 1) * limit;

    const query = {};
    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (status === 'frozen') query.isFrozen = true;

    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query)
    ]);

    res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  FREEZE / UNFREEZE PASSENGER
// =====================
const freezePassenger = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.isFrozen = !user.isFrozen;
    await user.save();

    res.json({
      success: true,
      message: user.isFrozen ? `${user.name} account frozen.` : `${user.name} account unfrozen.`,
      user
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  DELETE PASSENGER
// =====================
const deletePassenger = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Passenger deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  GET ALL RIDES
// =====================
const getAllRides = async (req, res) => {
  try {
    const { status, page = 1, limit: limitParam } = req.query;
    const limit = Math.min(parseInt(limitParam) || 20, 200); // allow up to 200 for cancellation history
    const skip  = (parseInt(page) - 1) * limit;

    const query = {};
    if (status && status !== 'all') query.status = status;

    const [rides, total] = await Promise.all([
      Ride.find(query)
        .sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('passenger', 'name phone')
        .populate('driver', 'fullName phone vehicle'),
      Ride.countDocuments(query)
    ]);

    res.json({ success: true, rides, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  CHANGE ADMIN PASSWORD
// =====================
const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.user._id);
    const match = await admin.matchPassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password is wrong.' });
    if (newPassword.length < 8)
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    admin.password = newPassword;
    await admin.save();
    res.json({ success: true, message: 'Admin password changed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  ACTIVITY LOG
// =====================
const getActivity = async (req, res) => {
  try {
    const recentRides   = await Ride.find({}).sort({ createdAt: -1 }).limit(10)
      .populate('passenger', 'name').populate('driver', 'fullName');
    const recentDrivers = await Driver.find({}).sort({ createdAt: -1 }).limit(10).select('fullName status createdAt');
    const recentUsers   = await User.find({}).sort({ createdAt: -1 }).limit(10).select('name createdAt');

    const log = [];
    recentRides.forEach(r => {
      log.push({
        icon: r.status === 'completed' ? '✅' : r.status === 'cancelled' ? '❌' : '🚗',
        text: `Ride: ${r.passenger?.name || '?'} → ${r.destination?.address?.split(',')[0] || '?'} [${r.status}]`,
        time: r.createdAt
      });
    });
    recentDrivers.forEach(d => {
      log.push({ icon: '🚗', text: `New driver signup: ${d.fullName} (${d.status})`, time: d.createdAt });
    });
    recentUsers.forEach(u => {
      log.push({ icon: '👤', text: `New passenger: ${u.name}`, time: u.createdAt });
    });

    log.sort((a, b) => new Date(b.time) - new Date(a.time));
    res.json({ success: true, log: log.slice(0, 30) });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================================================
//  SUBSCRIPTION MANAGEMENT
// =====================================================

// GET /api/admin/subscriptions/pending
const getPendingSubscriptions = async (req, res) => {
  try {
    const drivers = await Driver.find({
      status: 'approved',
      'subscription.paymentStatus': 'pending'
    })
    .select('-password')
    .sort({ 'subscription.submittedAt': -1 });

    res.json({ success: true, drivers, total: drivers.length });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// PUT /api/admin/drivers/:id/subscription
const reviewSubscription = async (req, res) => {
  try {
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be "approve" or "reject"' });
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    const approved = action === 'approve';

    driver.subscription = driver.subscription || {};
    driver.subscription.paymentStatus = approved ? 'approved' : 'rejected';
    driver.subscription.reviewedAt    = new Date();
    driver.subscription.reviewedBy    = req.user._id;

    if (approved) {
      const plan = driver.subscription.plan || 'monthly';
      // FIX: use separate Date objects to avoid mutation bug
      const startDate = new Date();
      const endDate   = plan === 'yearly'
        ? new Date(new Date(startDate).setFullYear(startDate.getFullYear() + 1))
        : new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));

      driver.subscription.isActive  = true;
      driver.subscription.startDate = startDate;
      driver.subscription.endDate   = endDate;
    } else {
      driver.subscription.isActive = false;
    }

    await driver.save();

    sendDriverSubscriptionResult(driver, approved).catch(() => {});

    res.json({
      success: true,
      message: approved
        ? `${driver.fullName}'s subscription has been approved.`
        : `${driver.fullName}'s subscription has been rejected.`,
      driver
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  adminLogin,
  getDashboardStats,
  getAllDrivers,
  getDriverDetail,
  approveDriver,
  rejectDriver,
  suspendDriver,
  deleteDriver,
  getAllPassengers,
  freezePassenger,
  deletePassenger,
  getAllRides,
  changeAdminPassword,
  getActivity,
  getPendingSubscriptions,
  reviewSubscription
};
