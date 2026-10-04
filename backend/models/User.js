const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, required: true, unique: true, trim: true },
  email:        { type: String, trim: true, lowercase: true, default: '' },
  password:     { type: String, required: true, minlength: 6 },
  role:         { type: String, default: 'passenger' },
  profilePhoto: { type: String, default: '' },
  rating:       { average: { type: Number, default: 5.0 }, count: { type: Number, default: 0 } },
  totalRides:   { type: Number, default: 0 },
  totalSpent:   { type: Number, default: 0 },

  // Approval system — admin can require approval or allow auto-login
  // 'active' = can login, 'pending' = waiting for admin, 'frozen' = blocked
  status: {
    type: String,
    enum: ['active', 'pending', 'frozen', 'banned'],
    default: 'active'  // default: auto-approve (admin can change this in settings)
  },

  isFrozen:     { type: Boolean, default: false },
  frozenReason: { type: String, default: '' },
  isActive:     { type: Boolean, default: true },
  lastLogin:    { type: Date, default: null }

}, { timestamps: true });

userSchema.index({ phone: 1 });
userSchema.index({ status: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
