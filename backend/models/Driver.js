// =====================================================
//  models/Driver.js  —  Driver schema
// =====================================================

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const driverSchema = new mongoose.Schema({

  // Personal info
  fullName: { type: String, required: true, trim: true },
  phone:    { type: String, required: true, unique: true, trim: true },
  email:    { type: String, trim: true, lowercase: true, default: '' },
  password: { type: String, required: true, minlength: 6 },
  cnic:     { type: String, required: true, unique: true },
  city:     { type: String, required: true },
  serviceType: {
    type: String,
    enum: ['City Rides Only', 'Intercity Only', 'Both City & Intercity'],
    required: true
  },
  profilePhoto: { type: String, default: '' },

  // Vehicle info
  vehicle: {
    make:  { type: String, required: true },
    model: { type: String, required: true },
    year:  { type: Number, required: true },
    color: { type: String, required: true },
    plate: { type: String, required: true, uppercase: true },
    // ✅ FIXED: Added 'rickshaw' and 'motorbike' to vehicle types
    type:  { type: String, enum: ['car', 'suv', 'van', 'bike', 'rickshaw', 'motorbike'], default: 'car' }
  },

  // Uploaded documents (file paths stored here)
  documents: {
    cnicFront:     { type: String, default: '' },
    cnicBack:      { type: String, default: '' },
    drivingLicense:{ type: String, default: '' },
    vehicleReg:    { type: String, default: '' },
    driverPhoto:   { type: String, default: '' },
    vehiclePhoto:  { type: String, default: '' }
  },

  // Account status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },

  // Online/offline toggle
  isOnline: { type: Boolean, default: false },

  // Live GPS location
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },

  // Ratings
  rating: {
    average: { type: Number, default: 5.0 },
    count:   { type: Number, default: 0 }
  },

  // Earnings
  totalEarnings:  { type: Number, default: 0 },
  completedRides: { type: Number, default: 0 },

  // Current active ride (if any)
  currentRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },

  rejectionReason: { type: String, default: '' },
  role: { type: String, default: 'driver' },

  // ✅ NEW: Subscription tracking
  subscription: {
    plan:          { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    amount:        { type: Number, default: 0 },
    paymentMethod: { type: String, default: '' },
    proofFile:     { type: String, default: '' },
    paymentStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    isActive:      { type: Boolean, default: false },
    startDate:     { type: Date },
    endDate:       { type: Date },
    submittedAt:   { type: Date },
    reviewedAt:    { type: Date },
    reviewedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
  }

}, { timestamps: true });

// Geospatial index for finding nearby drivers
driverSchema.index({ location: '2dsphere' });

// Hash password before saving
driverSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Check password method
driverSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('Driver', driverSchema);
