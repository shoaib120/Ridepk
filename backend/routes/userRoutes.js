// routes/userRoutes.js
const express = require('express');
const router  = express.Router();
const { getProfile, updateProfile, changePassword } = require('../controllers/userController');
const { protect, passengerOnly } = require('../middleware/auth');

router.use(protect, passengerOnly);

router.get('/profile',         getProfile);
router.put('/profile',         updateProfile);
router.put('/change-password', changePassword);

module.exports = router;
