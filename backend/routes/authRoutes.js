// =====================================================
//  routes/authRoutes.js
// =====================================================

const express = require('express');
const router  = express.Router();
const {
  registerPassenger,
  login,
  getMe,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
router.post('/register',        registerPassenger);
router.post('/login',           login);
router.get('/me',               getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

module.exports = router;
