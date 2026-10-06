// =====================================================
//  models/Ride.js
// =====================================================

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text:       { type: String, required: true },
  senderType: { type: String, enum: ['passenger', 'driver'], default: 'passenger' },
  createdAt:  { type: Date, default: Date.now }
}, { _id: false });

const rideSchema = new mongoose.Schema({

  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },

  pickup: {
    address:     { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },

  destination: {
    address:     { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },

  vehicleType: {
    type: String,
    enum: ['car', 'motorbike', 'rickshaw'],
    default: 'car'
  },

  rideType: {
    type: String,
    enum: ['economy', 'comfort', 'intercity'],
    default: 'economy'
  },

  distanceKm:  { type: Number, default: 0 },
  durationMin: { type: Number, default: 0 },

  // Price negotiation
  offeredPrice: { type: Number, required: true },
  counterOffer: { type: Number, default: null },  // passenger's lower offer
  finalPrice:   { type: Number, default: null },  // agreed price

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

  status: {
    type: String,
    enum: ['searching', 'accepted', 'driver_arrived', 'in_progress', 'completed', 'cancelled'],
    default: 'searching'
  },

  acceptedAt:  { type: Date, default: null },
  startedAt:   { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: null },

  passengerRating: { type: Number, min: 1, max: 5, default: null },
  driverRating:    { type: Number, min: 1, max: 5, default: null },
  passengerReview: { type: String, default: '' },
  driverReview:    { type: String, default: '' },

  messages: [messageSchema]

}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);