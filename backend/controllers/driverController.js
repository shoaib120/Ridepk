// =====================================================
//  backend/controllers/driverController.js
// =====================================================
// ⚠️  Do NOT modify mailer.js or any email-related code.

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Driver = require('../models/Driver');
const Ride   = require('../models/Ride');
const {
  sendDriverWelcomeEmail,
  sendAdminDriverNotification
} = require('../config/mailer');

// ── Helper: generate JWT ─────────────────────────────────────────────────────
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── Helper: extract driver ID from Bearer token ──────────────────────────────
function getDriverId(req) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id || decoded._id || decoded.driverId || null;
  } catch (e) { return null; }
}

// ── POST /api/drivers/register ───────────────────────────────────────────────
exports.registerDriver = async (req, res) => {
  try {
    const { fullName, phone, email, password, city, serviceType, cnic, vehicle } = req.body;

    // ── Required field validation ────────────────────────────────────────────
    if (!fullName || !phone || !password) {
      return res.status(400).json({ message: 'fullName, phone and password are required' });
    }

    // ── Required document validation ─────────────────────────────────────────
    const requiredDocs = ['cnic-front', 'cnic-back', 'license', 'vehicle-reg', 'photo'];
    if (!req.files) {
      return res.status(400).json({ message: 'Please upload all required documents (CNIC front, CNIC back, driving license, vehicle registration, your photo).' });
    }
    for (const docKey of requiredDocs) {
      if (!req.files[docKey] || req.files[docKey].length === 0) {
        const labels = {
          'cnic-front':  'CNIC Front',
          'cnic-back':   'CNIC Back',
          'license':     'Driving License',
          'vehicle-reg': 'Vehicle Registration',
          'photo':       'Your Photo'
        };
        return res.status(400).json({ message: 'Missing required document: ' + (labels[docKey] || docKey) });
      }
    }

    // ── Duplicate phone check ─────────────────────────────────────────────────
    const exists = await Driver.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'Phone number already registered' });

    const hashed = await bcrypt.hash(password, 10);

    // ── Build document paths from uploaded files ──────────────────────────────
    const docs = {};
    if (req.files['cnic-front'])    docs.cnicFront    = req.files['cnic-front'][0].path;
    if (req.files['cnic-back'])     docs.cnicBack     = req.files['cnic-back'][0].path;
    if (req.files['license'])       docs.license      = req.files['license'][0].path;
    if (req.files['vehicle-reg'])   docs.vehicleReg   = req.files['vehicle-reg'][0].path;
    if (req.files['photo'])         docs.photo        = req.files['photo'][0].path;
    if (req.files['vehicle-photo']) docs.vehiclePhoto = req.files['vehicle-photo'][0].path;

    // ── Parse vehicle info (arrives as JSON string from multipart form) ───────
    let vehicleData = vehicle;
    if (typeof vehicle === 'string') {
      try { vehicleData = JSON.parse(vehicle); } catch (e) { vehicleData = {}; }
    }

    const driver = await Driver.create({
      fullName,
      phone,
      email:       email || '',
      password:    hashed,
      city:        city  || '',
      cnic:        cnic  || '',
      serviceType: serviceType || '',
      vehicle:     vehicleData || {},
      documents:   docs,
      status:      'pending',    // requires admin approval
      isOnline:    false,
      location:    { type: 'Point', coordinates: [0, 0] }
    });

    // ── Send notification emails (fire-and-forget, never block response) ──────
    sendDriverWelcomeEmail(driver).catch(err =>
      console.error('sendDriverWelcomeEmail failed:', err.message)
    );
    sendAdminDriverNotification(driver).catch(err =>
      console.error('sendAdminDriverNotification failed:', err.message)
    );

    const token = generateToken(driver._id, 'driver');
    res.status(201).json({
      success: true,
      message: 'Driver registered successfully. Awaiting admin approval.',
      token,
      driver: {
        _id:      driver._id,
        fullName: driver.fullName,
        phone:    driver.phone,
        city:     driver.city,
        status:   driver.status
      }
    });
  } catch (err) {
    console.error('registerDriver error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/drivers/login ──────────────────────────────────────────────────
exports.loginDriver = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ message: 'Phone and password are required' });

    const driver = await Driver.findOne({ phone });
    if (!driver) return res.status(401).json({ message: 'Invalid phone or password' });

    const match = await bcrypt.compare(password, driver.password);
    if (!match) return res.status(401).json({ message: 'Invalid phone or password' });

    // Block non-approved accounts with descriptive messages the frontend uses
    if (driver.status === 'pending') {
      return res.status(403).json({ message: 'Your application is pending approval.' });
    }
    if (driver.status === 'rejected') {
      return res.status(403).json({ message: 'Your application was rejected. Contact support.' });
    }
    if (driver.status === 'suspended') {
      return res.status(403).json({ message: 'Your account has been suspended. Contact support.' });
    }

    const token = generateToken(driver._id, 'driver');
    res.json({
      success: true,          // ← frontend checks data.success === true
      message: 'Login successful',
      token,
      driver: {
        _id:      driver._id,
        fullName: driver.fullName,
        phone:    driver.phone,
        city:     driver.city,
        status:   driver.status,
        isOnline: driver.isOnline,
        vehicle:  driver.vehicle,
        rating:   driver.rating
      }
    });
  } catch (err) {
    console.error('loginDriver error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/drivers/profile ─────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const driverId = req.driver?._id || getDriverId(req);
    if (!driverId) return res.status(401).json({ message: 'Unauthorized' });

    const driver = await Driver.findById(driverId).select('-password');
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    res.json({ success: true, driver }); // ← dashboard checks data.success
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── PUT /api/drivers/toggle-online ───────────────────────────────────────────
exports.toggleOnline = async (req, res) => {
  try {
    const driverId = req.driver?._id || getDriverId(req);
    if (!driverId) return res.status(401).json({ message: 'Unauthorized' });

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    if (driver.status !== 'approved') {
      return res.status(403).json({ message: 'Account not yet approved by admin' });
    }

    driver.isOnline = !driver.isOnline;
    await driver.save();

    res.json({ success: true, message: driver.isOnline ? 'You are now online' : 'You are now offline', isOnline: driver.isOnline });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/drivers/nearby ───────────────────────────────────────────────────
exports.getNearbyDrivers = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // radius in km
    if (!lat || !lng)
      return res.status(400).json({ message: 'lat and lng query params are required' });

    const radiusInRadians = parseFloat(radius) / 6371;

    const drivers = await Driver.find({
      isOnline: true,
      status:   'approved',
      location: {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusInRadians]
        }
      }
    }).select('fullName phone vehicle rating location city');

    res.json({ drivers });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── PUT /api/drivers/location ────────────────────────────────────────────────
// Body: { lat, lng }
// Rejects Gilgit-Baltistan (lat > 35.5°N) — service area is AJK/Punjab only.
exports.updateLocation = async (req, res) => {
  try {
    const driverId = req.driver?._id || getDriverId(req);
    if (!driverId) return res.status(401).json({ message: 'Unauthorized' });

    const lat = parseFloat(req.body.lat);
    const lng = parseFloat(req.body.lng);

    if (isNaN(lat) || isNaN(lng))
      return res.status(400).json({ message: 'Invalid coordinates' });

    // Reject null island
    if (Math.abs(lat) < 0.5 && Math.abs(lng) < 0.5)
      return res.status(400).json({ message: 'Invalid coordinates (null island)' });

    // Service area bounding box — rejects Gilgit (35.9°N > 35.5 limit)
    if (lat < 23 || lat > 35.5 || lng < 60 || lng > 77) {
      return res.status(400).json({
        message: 'Coordinates outside service area (AJK/Punjab)',
        received: { lat, lng }
      });
    }

    // GeoJSON stores [lng, lat] — longitude first
    await Driver.findByIdAndUpdate(driverId, {
      location: { type: 'Point', coordinates: [lng, lat] }
    });

    res.json({ success: true, lat, lng });
  } catch (err) {
    console.error('updateLocation error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/drivers/earnings ─────────────────────────────────────────────────
exports.getEarnings = async (req, res) => {
  try {
    const driverId = req.driver?._id || getDriverId(req);
    if (!driverId) return res.status(401).json({ message: 'Unauthorized' });

    const rides = await Ride.find({
      driver: driverId,
      status: 'completed'
    }).select('finalPrice estimatedFare createdAt completedAt pickup destination').sort({ createdAt: -1 });

    const total = rides.reduce((sum, r) => sum + (r.finalPrice || r.estimatedFare || 0), 0);

    // Last 7 days breakdown
    const now    = new Date();
    const week   = rides.filter(r => (now - new Date(r.createdAt)) < 7 * 24 * 3600 * 1000);
    const weekTotal = week.reduce((sum, r) => sum + (r.finalPrice || r.estimatedFare || 0), 0);

    // Today's breakdown — rides completed today (since midnight local time)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRidesList = rides.filter(r => {
      // Use completedAt if available, fall back to createdAt
      const rideDate = r.completedAt ? new Date(r.completedAt) : new Date(r.createdAt);
      return rideDate >= todayStart;
    });
    const todayEarnings = todayRidesList.reduce((sum, r) => sum + (r.finalPrice || r.estimatedFare || 0), 0);

    res.json({
      success:        true,
      totalEarnings:  total,
      weekEarnings:   weekTotal,
      todayEarnings:  todayEarnings,
      todayRides:     todayRidesList.length,
      totalRides:     rides.length,
      recentRides:    rides.slice(0, 20)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/drivers/subscription/plans ──────────────────────────────────────
exports.getSubscriptionPlans = async (req, res) => {
  res.json({
    plans: [
      { id: 'basic',    name: 'Basic',    price: 500,  duration: 30, ridesLimit: 50,  description: 'Up to 50 rides per month' },
      { id: 'standard', name: 'Standard', price: 1000, duration: 30, ridesLimit: 150, description: 'Up to 150 rides per month' },
      { id: 'premium',  name: 'Premium',  price: 1800, duration: 30, ridesLimit: null, description: 'Unlimited rides per month' }
    ]
  });
};

// ── POST /api/drivers/subscription/submit ─────────────────────────────────────
exports.submitSubscriptionProof = async (req, res) => {
  try {
    const driverId = req.driver?._id || getDriverId(req);
    if (!driverId) return res.status(401).json({ message: 'Unauthorized' });

    const { plan } = req.body;
    const proofPath = req.file ? req.file.path : null;

    if (!plan)       return res.status(400).json({ message: 'Plan is required' });
    if (!proofPath)  return res.status(400).json({ message: 'Payment proof image is required' });

    await Driver.findByIdAndUpdate(driverId, {
      'subscription.plan':          plan,
      'subscription.proofPath':     proofPath,
      'subscription.status':        'pending',
      'subscription.submittedAt':   new Date()
    });

    res.json({ success: true, message: 'Subscription proof submitted. Awaiting admin approval.', plan });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/drivers/subscription ────────────────────────────────────────────
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const driverId = req.driver?._id || getDriverId(req);
    if (!driverId) return res.status(401).json({ message: 'Unauthorized' });

    const driver = await Driver.findById(driverId).select('subscription fullName');
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    res.json({ success: true, subscription: driver.subscription || { status: 'none' } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
