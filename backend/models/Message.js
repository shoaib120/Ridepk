// models/Message.js — In-ride chat messages between passenger and driver

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  ride:       { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
  senderType: { type: String, enum: ['passenger', 'driver'], required: true },
  senderId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  senderName: { type: String, default: '' },
  text:       { type: String, required: true, maxlength: 500 },
  sentAt:     { type: Date,   default: Date.now }
});

MessageSchema.index({ ride: 1, sentAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
