// =====================================================
//  backend/routes/driverRoutes.js
// =====================================================

const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const router     = express.Router();
const { protect } = require('../middleware/auth');
const {
  registerDriver,
  loginDriver,
  getProfile,
  toggleOnline,
  getNearbyDrivers,
  getEarnings,
  getSubscriptionPlans,
  submitSubscriptionProof,
  getSubscriptionStatus,
  updateLocation
} = require('../controllers/driverController');

// ── Auto-create uploads/ folder so Multer never crashes ──────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created missing uploads/ folder at:', uploadsDir);
}

// ── Multer storage config ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadsDir); },
  filename:    function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
  fileFilter: function (req, file, cb) {
    const allowed = /jpg|jpeg|png|pdf/i;
    const ext = path.extname(file.originalname);
    if (allowed.test(ext)) { cb(null, true); }
    else { cb(new Error('Only JPG, PNG, and PDF files are allowed.')); }
  }
});

// Document upload fields
const docFields = upload.fields([
  { name: 'cnic-front',    maxCount: 1 },
  { name: 'cnic-back',     maxCount: 1 },
  { name: 'license',       maxCount: 1 },
  { name: 'vehicle-reg',   maxCount: 1 },
  { name: 'photo',         maxCount: 1 },
  { name: 'vehicle-photo', maxCount: 1 }
]);

// ── Multer error handler ──────────────────────────────────────────────
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5 MB per file.' });
    }
    return res.status(400).json({ message: 'File upload error: ' + err.message });
  }
  if (err && err.message) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
}

// ── Routes ────────────────────────────────────────────────────────────

// Public
router.post('/register', docFields, handleMulterError, registerDriver);
router.post('/login',    loginDriver);
router.get('/nearby',    getNearbyDrivers);

// Protected (require driver JWT)
router.get('/profile',              protect, getProfile);
router.put('/toggle-online',        protect, toggleOnline);
router.put('/location',             protect, updateLocation);
router.get('/earnings',             protect, getEarnings);
router.get('/subscription',         protect, getSubscriptionStatus);
router.get('/subscription/plans',   protect, getSubscriptionPlans);

// Subscription proof upload (single file: screenshot/receipt)
router.post('/subscription/submit', protect,
  upload.single('proof'),
  handleMulterError,
  submitSubscriptionProof
);

module.exports = router;
