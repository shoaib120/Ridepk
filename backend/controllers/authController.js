// =====================================================
//  controllers/authController.js
//  Handles: Register passenger, Login (both), GetMe,
//           Forgot Password, Reset Password
// =====================================================

const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const nodemailer = require('nodemailer');
const User     = require('../models/User');
const Driver   = require('../models/Driver');
const {
  sendPassengerWelcomeEmail,
  sendAdminPassengerNotification
} = require('../config/mailer');

// ===== GENERATE JWT TOKEN =====
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ===== SEND RESET EMAIL (inline — does not touch mailer.js) =====
async function sendResetEmail(toEmail, toName, resetUrl) {
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from:    '"RidePK" <' + (process.env.SMTP_USER || process.env.EMAIL_USER) + '>',
    to:      toEmail,
    subject: 'RidePK — Password Reset Request',
    html: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">' +
          '<h2 style="color:#ff6b00">🚗 RidePK Password Reset</h2>' +
          '<p>Hi ' + (toName || 'User') + ',</p>' +
          '<p>You requested a password reset. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>' +
          '<a href="' + resetUrl + '" style="display:inline-block;margin:20px 0;background:#ff6b00;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Reset My Password</a>' +
          '<p>If you didn\'t request this, please ignore this email.</p>' +
          '<p style="color:#999;font-size:0.85em">RidePK — Mirpur AJK, Pakistan</p>' +
          '</div>'
  });
}

// =====================
//  REGISTER PASSENGER
//  POST /api/auth/register
// =====================
const registerPassenger = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'Name, phone and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const exists = await User.findOne({ phone });
    if (exists) {
      return res.status(400).json({ message: 'This phone number is already registered.' });
    }

    const user = await User.create({ name, phone, email, password });

    sendPassengerWelcomeEmail(user).catch(() => {});
    sendAdminPassengerNotification(user).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token: generateToken(user._id, 'passenger'),
      user: {
        id:    user._id,
        name:  user.name,
        phone: user.phone,
        email: user.email,
        role:  'passenger'
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// =====================
//  LOGIN (PASSENGER OR DRIVER)
//  POST /api/auth/login
// =====================
const login = async (req, res) => {
  try {
    const { phone, password, role } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required.' });
    }

    let account = null;
    let accountRole = role || 'passenger';

    if (accountRole === 'driver') {
      account = await Driver.findOne({ phone });
      if (!account) {
        return res.status(401).json({ message: 'No driver account found with this phone number.' });
      }
      if (account.status === 'pending') {
        return res.status(403).json({ message: 'Your driver account is pending approval. Please wait 24–48 hours.' });
      }
      if (account.status === 'rejected') {
        return res.status(403).json({ message: 'Your driver application was rejected. Please contact support.' });
      }
      if (account.status === 'suspended') {
        return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
      }
    } else {
      account = await User.findOne({ phone });
      if (!account) {
        return res.status(401).json({ message: 'No account found with this phone number.' });
      }
    }

    const isMatch = await account.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    res.json({
      success: true,
      message: 'Login successful!',
      token: generateToken(account._id, accountRole),
      user: {
        id:     account._id,
        name:   account.fullName || account.name,
        phone:  account.phone,
        role:   accountRole,
        city:   account.city || '',
        rating: account.rating ? (account.rating.average || 5.0) : 5.0
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// =====================
//  GET CURRENT USER
//  GET /api/auth/me
// =====================
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// =====================
//  FORGOT PASSWORD
//  POST /api/auth/forgot-password
// =====================
const forgotPassword = async (req, res) => {
  try {
    const { phone, role } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const accountRole = (role === 'driver') ? 'driver' : 'passenger';
    const Model = (accountRole === 'driver') ? Driver : User;

    let user = null;
    try {
      user = await Model.findOne({ phone });
    } catch (e) {
      // collection lookup error — treat as not found (security)
    }

    // Security: always return the same message whether or not the phone exists
    if (!user) {
      return res.json({ success: true, message: 'If that phone is registered, a reset email was sent.' });
    }

    if (!user.email) {
      return res.json({ success: false, message: 'No email address on file for this account.' });
    }

    // Generate raw token and its hash
    const resetToken  = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store hash + expiry on user document (works even if model schema doesn't pre-declare these fields)
    await Model.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken:   hashedToken,
          resetPasswordExpires: Date.now() + 3600000  // 1 hour
        }
      }
    );

    const frontendBase = (process.env.FRONTEND_URL || 'https://ridepk.netlify.app').replace(/\/$/, '');
    const resetUrl = frontendBase + '/reset-password.html?token=' + resetToken;

    try {
      await sendResetEmail(user.email, user.name || user.fullName || '', resetUrl);
    } catch (mailErr) {
      console.error('[ForgotPassword] Mail error:', mailErr.message);
      // Still return generic success — don't leak info
    }

    return res.json({ success: true, message: 'If that phone is registered, a reset email was sent.' });

  } catch (err) {
    console.error('forgotPassword error:', err);
    // Security: generic response on unexpected errors
    return res.json({ success: true, message: 'If that phone is registered, a reset email was sent.' });
  }
};

// =====================
//  RESET PASSWORD
//  POST /api/auth/reset-password
// =====================
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset token is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const now = Date.now();

    // Search both User and Driver collections
    let user   = null;
    let Model  = null;

    const passenger = await User.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: now }
    });

    if (passenger) {
      user  = passenger;
      Model = User;
    } else {
      const driver = await Driver.findOne({
        resetPasswordToken:   hashedToken,
        resetPasswordExpires: { $gt: now }
      });
      if (driver) {
        user  = driver;
        Model = Driver;
      }
    }

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    // Set new password — pre-save hook on the model will hash it
    user.password             = password;
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ success: true, message: 'Password reset successfully.' });

  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ success: false, message: 'Server error during password reset.' });
  }
};

module.exports = { registerPassenger, login, getMe, forgotPassword, resetPassword };
