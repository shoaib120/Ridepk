// =====================================================
//  backend/controllers/driverController.js
// =====================================================
// ⚠️  Do NOT modify mailer.js or any email-related code.

const Driver = require('../models/Driver');
const jwt    = require('jsonwebtoken');
const {
  sendDriverWelcomeEmail,
  sendAdminDriverNotification
} = require('../config/mailer');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

// =====================
//  REGISTER DRIVER
//  POST /api/drivers/register
// =====================
const registerDriver = async (req, res) => {
  try {
    const {
      fullName, phone, email, cnic, city,
      serviceType, password, vehicle
    } = req.body;

    // Validate required personal fields
    if (!fullName || !phone || !cnic || !city || !serviceType || !password) {
      return res.status(400).json({ message: 'All personal fields are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // Validate required documents
    const requiredDocs = ['cnic-front', 'cnic-back', 'license', 'vehicle-reg', 'photo'];
    if (!req.files) {
      return res.status(400).json({ message: 'Please upload all required documents.' });
    }
    for (const key of requiredDocs) {
      if (!req.files[key] || req.files[key].length === 0) {
        const labels = {
          'cnic-front':  'CNIC Front',
          'cnic-back':   'CNIC Back',
          'license':     'Driving License',
          'vehicle-reg': 'Vehicle Registration',
          'photo':       'Your Photo'
        };
        return res.status(400).json({ message: 'Missing required document: ' + (labels[key] || key) });
      }
    }

    // Check duplicates
    const phoneExists = await Driver.findOne({ phone });
    if (phoneExists) return res.status(400).json({ message: 'A driver with this phone number already exists.' });

    const cnicExists = await Driver.findOne({ cnic });
    if (cnicExists) return res.status(400).json({ message: 'A driver with this CNIC already exists.' });

    // Handle uploaded document paths
    // ⚠️  Store only the FILENAME — the backend serves files at /uploads/<filename>
    const documents = {};
    if (req.files['cnic-front'])    documents.cnicFront      = req.files['cnic-front'][0].filename;
    if (req.files['cnic-back'])     documents.cnicBack       = req.files['cnic-back'][0].filename;
    if (req.files['license'])       documents.drivingLicense = req.files['license'][0].filename;
    if (req.files['vehicle-reg'])   documents.vehicleReg     = req.files['vehicle-reg'][0].filename;
    if (req.files['photo'])         documents.driverPhoto    = req.files['photo'][0].filename;
    if (req.files['vehicle-photo']) documents.vehiclePhoto   = req.files['vehicle-photo'][0].filename;

    // Parse vehicle if sent as JSON string (multipart/form-data)
    let vehicleData = vehicle;
    if (typeof vehicle === 'string') {
      try { vehicleData = JSON.parse(vehicle); } catch (e) { vehicleData = {}; }
    }

    // Validate vehicle
    if (!vehicleData || !vehicleData.make || !vehicleData.model || !vehicleData.plate) {
      return res.status(400).json({ message: 'All vehicle fields are required.' });
    }

    // Create driver
    // ✅ Do NOT hash password here — the Driver model pre('save') hook hashes it automatically
    const driver = await Driver.create({
      fullName, phone,
      email:       email || '',
      cnic,
      city,
      serviceType,
      password,          // plain text — model hashes it in pre-save hook
      vehicle:     vehicleData,
      documents,
      status:      'pending'  // admin must approve
    });

    // Send notification emails (fire-and-forget — never block the response)
    sendDriverWelcomeEmail(driver).catch(err =>
      console.error('sendDriverWelcomeEmail failed:', err.message)
    );
    sendAdminDriverNotification(driver).catch(err =>
      console.error('sendAdminDriverNotification failed:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Application submitted! We will review and contact you within 24–48 hours.',
      driverId: driver._id
    });

  } catch (error) {
    console.error('Driver register error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// =====================
//  GET DRIVER PROFILE
//  GET /api/drivers/profile
// =====================
const getProfile = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user._id).select('-password -documents');
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });
    res.json({ success: true, driver });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  TOGGLE ONLINE/OFFLINE
//  PUT /api/drivers/toggle-online
// =====================
const toggleOnline = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user._id);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    if (driver.status !== 'approved') {
      return res.status(403).json({ message: 'Your account must be approved before going online.' });
    }

    driver.isOnline = !driver.isOnline;
    await driver.save();

    res.json({
      success:  true,
      isOnline: driver.isOnline,
      message:  driver.isOnline ? 'You are now online. Ride requests will appear.' : 'You are now offline.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// =====================
//  FIND NEARBY DRIVERS
//  GET /api/drivers/nearby?lat=31.5&lng=74.3&radius=5
// =====================
const getNearbyDrivers = async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng are required.' });

    const drivers = await Driver.find({
      isOnline: true,
      status:   'approved',
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000
        }
      }
    })
    .select('fullName rating vehicle location profilePhoto')
    .limit(10);

    res.json({ success: true, count: drivers.length, drivers });
  } catch (error) {
    // Geospatial query may fail if index not yet set — fallback
    const drivers = await Driver.find({ isOnline: true, status: 'approved' })
      .select('fullName rating vehicle profilePhoto').limit(10);
    res.json({ success: true, count: drivers.length, drivers });
  }
};

// =====================
//  GET DRIVER EARNINGS
//  GET /api/drivers/earnings
// =====================
const getEarnings = async (req, res) => {
  try {
    const Ride = require('../models/Ride');
    const rides = await Ride.find({
      driver: req.user._id,
      status: 'completed'
    }).sort({ completedAt: -1 }).limit(50);

    const totalEarnings = rides.reduce((sum, r) => sum + (r.finalPrice || 0), 0);
    const todayRides = rides.filter(r => {
      const today    = new Date();
      const rideDate = new Date(r.completedAt);
      return rideDate.toDateString() === today.toDateString();
    });
    const todayEarnings = todayRides.reduce((sum, r) => sum + (r.finalPrice || 0), 0);

    res.json({
      success:      true,
      totalEarnings,
      todayEarnings,
      totalRides:   rides.length,
      todayRides:   todayRides.length,
      recentRides:  rides.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { registerDriver, getProfile, toggleOnline, getNearbyDrivers, getEarnings };
