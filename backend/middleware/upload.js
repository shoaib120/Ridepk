// =====================================================
//  middleware/upload.js  —  File Upload (Multer)
//  Handles driver document uploads (CNIC, license etc)
// =====================================================
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Make sure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ===== STORAGE SETTINGS =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // e.g.  driver-1234567890-cnic-front.jpg
    const uniqueName = `driver-${Date.now()}-${file.fieldname}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// ===== FILE TYPE FILTER =====
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const isAllowed = allowed.test(path.extname(file.originalname).toLowerCase());
  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and PDF files are allowed.'));
  }
};

// ===== EXPORT UPLOAD HANDLER =====
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max per file
});

module.exports = upload;
