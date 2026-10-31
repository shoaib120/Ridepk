// =====================================================
//  middleware/upload.js  —  File Upload (Multer + Cloudinary)
//  Handles driver document uploads (CNIC, license etc)
// =====================================================
const multer              = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary          = require('cloudinary').v2;
const path                = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ===== CLOUDINARY STORAGE =====
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder:         'ridepk/documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    public_id:      `driver-${Date.now()}-${file.fieldname}`
  })
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