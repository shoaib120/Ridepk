// routes/messageRoutes.js — In-ride chat endpoints

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const { sendMessage, getMessages } = require('../controllers/messageController');

// ────────────────────────────────────────────────────────────
//  Combined auth middleware — accepts EITHER passenger or driver token
//  Sets req.user and req.userType = 'passenger' | 'driver'
// ────────────────────────────────────────────────────────────
function requireAnyAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // Distinguish by which field is populated
    req.userType = decoded.phone ? 'driver' : 'passenger';
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// POST  /api/rides/:id/messages  — send a message
// GET   /api/rides/:id/messages  — poll for messages
router.post('/:id/messages',  requireAnyAuth, sendMessage);
router.get ('/:id/messages',  requireAnyAuth, getMessages);

module.exports = router;
