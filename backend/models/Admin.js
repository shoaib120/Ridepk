// models/Admin.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true, trim: true },
  password:  { type: String, required: true, minlength: 8 },
  email:     { type: String, trim: true, lowercase: true, default: '' },
  role:      { type: String, default: 'admin' },
  lastLogin: { type: Date, default: null },

  settings: {
    // When true: new passengers wait for admin approval before login
    requirePassengerApproval: { type: Boolean, default: false },

    // Admin's notification email
    notificationEmail: { type: String, default: '' },

    // Cities that are LOCAL (within Mirpur Division)
    // If pickup AND destination are both in this list = City Ride
    // If destination is NOT in this list = Intercity ride
    intercityZones: {
      type: [String],
      default: ['Mirpur','Islamgarh','Dadyal','Chakswari','Bhimber','Kotli','Samahni','Rawalakot','New Mirpur','Mangla']
    }
  }

}, { timestamps: true });

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
