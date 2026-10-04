// =====================================================
//  models/Ride.js  —  Ride / Trip schema  (fix11)
// =====================================================

const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({

  // Who booked
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    required: true
  },

  // Who drives (assigned when driver accepts)
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Driver',
    default: null
  },

  // Pickup location
  pickup: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },

  // Destination
  destination: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },

  // Vehicle requested by passenger: motorbike | rickshaw | car
  vehicleType: {
    type: String,
    enum: ['motorbike', 'rickshaw', 'car'],
    required: true
  },

  // Ride category (kept for compatibility)
  rideType: {
    type: String,
    enum: ['economy', 'comfort', 'intercity'],
    default: 'economy'
  },

  distanceKm:  { type: Number, default: 0 },
  durationMin: { type: Number, default: 0 },

  // Price negotiation
  offeredPrice: { type: Number, required: true },  // passenger's initial offer
  counterPrice: { type: Number, default: null },    // passenger counter-offer
  finalPrice:   { type: Number, default: null },    // agreed final price

  paymentMethod: {
    type: String,
    enum: ['Cash', 'EasyPaisa', 'JazzCash', 'Card'],
    default: 'Cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },

  // Ride lifecycle status
  status: {
    type: String,
    enum: ['searching', 'accepted', 'driver_arrived', 'in_progress', 'completed', 'cancelled'],
    default: 'searching'
  },

  // Passenger info (cached so admin/driver sees it even without a User account)
  passengerName:  { type: String, default: '' },
  passengerPhone: { type: String, default: '' },

  // Timestamps
  acceptedAt:  { type: Date, default: null },
  startedAt:   { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: null },   // 'passenger' or 'driver'
  cancelReason:{ type: String, default: '' },

  // Ratings
  passengerRating: { type: Number, min: 1, max: 5, default: null },
  driverRating:    { type: Number, min: 1, max: 5, default: null },
  passengerReview: { type: String, default: '' },
  driverReview:    { type: String, default: '' },

  // In-ride chat messages
  messages: [{
    senderType: { type: String, enum: ['passenger', 'driver'], required: true },
    text:       { type: String, required: true, maxlength: 500 },
    sentAt:     { type: Date,   default: Date.now }
  }]

}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
