// routes/rideRoutes.js

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const {
  requestRide,
  getPendingRides,
  acceptRide,
  getRideStatus,
  cancelRide,
  completeRide,
  counterOffer,
  counterOfferResponse,
  getMessages,
  postMessage
} = require('../controllers/rideController');

// ────────────────────────────────────────────────────────────
//  Auth middleware helpers
// ────────────────────────────────────────────────────────────

// Attaches passenger if token present — does NOT block if absent
function optionalPassengerAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Normalise: controllers use req.user._id
    req.user = { _id: decoded.id || decoded._id, ...decoded };
  } catch (e) { /* invalid token — ignore */ }
  next();
}

// Requires a valid driver token
function requireDriverAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Driver token required.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Normalise: controllers use req.user._id
    req.user = { _id: decoded.id || decoded._id, ...decoded };
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired driver token.' });
  }
}

// ────────────────────────────────────────────────────────────
//  Routes
// ────────────────────────────────────────────────────────────

// Passenger books a ride
router.post('/request',   optionalPassengerAuth, requestRide);

// Driver polls for pending rides
router.get ('/pending',   requireDriverAuth,      getPendingRides);

// Driver accepts a ride (standard)
router.put ('/:id/accept',  requireDriverAuth,    acceptRide);

// Passenger sends a counter-offer (lower fare up to 10%)
router.put ('/:id/counter-offer',          optionalPassengerAuth, counterOffer);

// Driver responds to counter-offer (accept or reject)
router.put ('/:id/counter-offer-response', requireDriverAuth,     counterOfferResponse);

// Passenger polls ride status
router.get ('/:id/status',   getRideStatus);

// Cancel (passenger or driver can cancel — reason required)
router.put ('/:id/cancel',   cancelRide);

// Driver completes ride
router.put ('/:id/complete', requireDriverAuth, completeRide);

// In-ride chat messages (both passenger and driver can GET and POST)
router.get ('/:id/messages', getMessages);
router.post('/:id/messages', postMessage);

module.exports = router;
