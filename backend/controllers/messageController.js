// controllers/messageController.js — In-ride chat

const Message = require('../models/Message');
const Ride    = require('../models/Ride');

// ============================================================
//  POST /api/rides/:id/messages
//  Send a message (passenger OR driver)
//  Auth: passenger token OR driver token (checked in route middleware)
// ============================================================
const sendMessage = async (req, res) => {
  try {
    const { text, senderType } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }
    if (!senderType || !['passenger', 'driver'].includes(senderType)) {
      return res.status(400).json({ message: 'senderType must be passenger or driver.' });
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    // Only allow chatting on accepted or in_progress rides
    if (!['accepted', 'in_progress'].includes(ride.status)) {
      return res.status(409).json({ message: 'Chat is only available during an active ride.' });
    }

    const msg = await Message.create({
      ride:       ride._id,
      senderType,
      senderId:   req.user._id,
      senderName: req.user.name || req.user.fullName || 'Unknown',
      text:       text.trim().substring(0, 500)
    });

    res.status(201).json({
      success:  true,
      message: {
        _id:        msg._id,
        senderType: msg.senderType,
        senderName: msg.senderName,
        text:       msg.text,
        sentAt:     msg.sentAt
      }
    });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  GET /api/rides/:id/messages
//  Poll for messages. Returns all messages, optionally since a timestamp.
//  Query: ?since=ISO_DATE_STRING
//  Auth: passenger token OR driver token
// ============================================================
const getMessages = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).select('status');
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    var query = { ride: req.params.id };

    // Optional: only return messages newer than 'since' timestamp
    if (req.query.since) {
      var since = new Date(req.query.since);
      if (!isNaN(since.getTime())) {
        query.sentAt = { $gt: since };
      }
    }

    const messages = await Message.find(query)
      .sort({ sentAt: 1 })
      .limit(200)
      .lean();

    res.json({
      success:  true,
      rideStatus: ride.status,
      messages: messages.map(function(m) {
        return {
          _id:        m._id,
          senderType: m.senderType,
          senderName: m.senderName,
          text:       m.text,
          sentAt:     m.sentAt
        };
      })
    });
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { sendMessage, getMessages };
