// =====================================================
//  controllers/rideController.js
//  All ride functions used by rideRoutes.js
// =====================================================

const Ride   = require('../models/Ride');
const Driver = require('../models/Driver');
const User   = require('../models/User');

// ─────────────────────────────────────────────────────
//  POST /api/rides/request
//  Passenger creates a ride request
// ─────────────────────────────────────────────────────
const requestRide = async (req, res) => {
  try {
    const {
      pickupAddress, pickupLat, pickupLng,
      destAddress,   destLat,   destLng,
      vehicleType, rideType,
      estimatedFare, distanceKm, durationMin,
      counterOffer,
      passengerName, passengerPhone
    } = req.body;

    // Validate required fields
    if (!pickupAddress || !destAddress) {
      return res.status(400).json({ message: 'Pickup and destination address are required.' });
    }
    if (!pickupLat || !pickupLng || !destLat || !destLng) {
      return res.status(400).json({ message: 'Pickup and destination coordinates are required.' });
    }
    if (!estimatedFare || estimatedFare < 50) {
      return res.status(400).json({ message: 'Minimum fare is Rs. 50.' });
    }

    // Block if passenger already has an active ride
    if (req.user && req.user._id) {
      const activeRide = await Ride.findOne({
        passenger: req.user._id,
        status: { $in: ['searching', 'accepted', 'driver_arrived', 'in_progress'] }
      });
      if (activeRide) {
        return res.status(400).json({ message: 'You already have an active ride.' });
      }
    }

    // Build ride document
    const ride = await Ride.create({
      passenger: req.user ? req.user._id : null,
      pickup: {
        address:     pickupAddress,
        coordinates: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) }
      },
      destination: {
        address:     destAddress,
        coordinates: { lat: parseFloat(destLat),   lng: parseFloat(destLng)  }
      },
      rideType:     rideType || 'economy',
      vehicleType:  vehicleType || 'car',
      distanceKm:   parseFloat(distanceKm)  || 0,
      durationMin:  parseInt(durationMin)   || 0,
      offeredPrice: parseFloat(estimatedFare),
      counterOffer: counterOffer ? parseFloat(counterOffer) : null,
      status:       'searching'
    });

    // Emit via Socket.io so online drivers see it instantly
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('ride:new', {
          rideId:        ride._id,
          pickupAddress,
          destAddress,
          pickupLat:     parseFloat(pickupLat),
          pickupLng:     parseFloat(pickupLng),
          vehicleType:   vehicleType || 'car',
          estimatedFare: parseFloat(estimatedFare),
          distanceKm:    parseFloat(distanceKm) || 0,
          durationMin:   parseInt(durationMin)  || 0,
          passengerName:  passengerName  || 'Passenger',
          passengerPhone: passengerPhone || ''
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error (non-fatal):', socketErr.message);
    }

    res.status(201).json({
      success: true,
      rideId:  ride._id,
      message: 'Ride request sent. Looking for nearby drivers.'
    });

  } catch (err) {
    console.error('requestRide error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  GET /api/rides/pending
//  Driver polls for available ride requests
// ─────────────────────────────────────────────────────
const getPendingRides = async (req, res) => {
  try {
    const rides = await Ride.find({ status: 'searching' })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('passenger', 'name phone rating');

    res.json({ success: true, rides });
  } catch (err) {
    console.error('getPendingRides error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  PUT /api/rides/:id/accept
//  Driver accepts a ride
// ─────────────────────────────────────────────────────
const acceptRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride)                       return res.status(404).json({ message: 'Ride not found.' });
    if (ride.status !== 'searching') return res.status(400).json({ message: 'This ride is no longer available.' });

    const driver = await Driver.findById(req.user._id);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });
    if (driver.currentRide) return res.status(400).json({ message: 'You already have an active ride.' });

    ride.driver     = req.user._id;
    ride.status     = 'accepted';
    ride.finalPrice = ride.counterOffer || ride.offeredPrice;
    ride.acceptedAt = new Date();
    await ride.save();

    driver.currentRide = ride._id;
    await driver.save();

    await ride.populate('passenger', 'name phone');
    await ride.populate('driver',    'fullName phone vehicle rating');

    // Notify via Socket.io — tells passenger their ride was accepted,
    // and tells other drivers this ride is gone
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('ride:taken', { rideId: ride._id });
        io.emit('ride:accepted', {
          rideId:     ride._id,
          driverName: driver.fullName,
          driverPhone: driver.phone,
          vehicle:    driver.vehicle
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error (non-fatal):', socketErr.message);
    }

    res.json({ success: true, message: 'Ride accepted!', ride });

  } catch (err) {
    console.error('acceptRide error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  GET /api/rides/:id/status
//  Passenger polls ride status
// ─────────────────────────────────────────────────────
const getRideStatus = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('driver', 'fullName phone vehicle rating location profilePhoto');

    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    res.json({
      success: true,
      status:  ride.status,
      ride
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  PUT /api/rides/:id/cancel
//  Passenger or driver cancels
// ─────────────────────────────────────────────────────
const cancelRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    if (['completed', 'cancelled'].includes(ride.status)) {
      return res.status(400).json({ message: 'Cannot cancel a ' + ride.status + ' ride.' });
    }

    ride.status      = 'cancelled';
    ride.cancelledAt = new Date();

    // Try to figure out who cancelled
    if (req.user) {
      const isPassenger = ride.passenger && String(ride.passenger) === String(req.user._id);
      ride.cancelledBy  = isPassenger ? 'passenger' : 'driver';
    }

    await ride.save();

    // Free the driver if one was assigned
    if (ride.driver) {
      await Driver.findByIdAndUpdate(ride.driver, { currentRide: null });
    }

    try {
      const io = req.app.get('io');
      if (io) io.emit('ride:cancelled', { rideId: ride._id });
    } catch (_) {}

    res.json({ success: true, message: 'Ride cancelled.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  PUT /api/rides/:id/complete
//  Driver completes ride
// ─────────────────────────────────────────────────────
const completeRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    if (String(ride.driver) !== String(req.user._id)) return res.status(403).json({ message: 'Not your ride.' });
    if (ride.status !== 'in_progress') return res.status(400).json({ message: 'Ride is not in progress.' });

    ride.status      = 'completed';
    ride.completedAt = new Date();
    ride.finalPrice  = ride.finalPrice || ride.offeredPrice;
    await ride.save();

    const driver = await Driver.findById(req.user._id);
    if (driver) {
      driver.currentRide     = null;
      driver.totalEarnings   = (driver.totalEarnings || 0) + ride.finalPrice;
      driver.completedRides  = (driver.completedRides || 0) + 1;
      await driver.save();
    }

    await User.findByIdAndUpdate(ride.passenger, { $inc: { totalRides: 1 } });

    res.json({ success: true, message: 'Ride completed!', ride });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  PUT /api/rides/:id/counter-offer
//  Passenger sends a lower fare counter-offer
// ─────────────────────────────────────────────────────
const counterOffer = async (req, res) => {
  try {
    const { amount } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride)                       return res.status(404).json({ message: 'Ride not found.' });
    if (ride.status !== 'searching') return res.status(400).json({ message: 'Ride is not in searching state.' });

    const minAllowed = Math.round(ride.offeredPrice * 0.90);
    if (amount < minAllowed) {
      return res.status(400).json({ message: 'Counter-offer cannot be less than 90% of the original fare.' });
    }

    ride.counterOffer = parseFloat(amount);
    await ride.save();

    res.json({ success: true, message: 'Counter-offer sent.', ride });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  PUT /api/rides/:id/counter-offer-response
//  Driver accepts or rejects passenger's counter-offer
// ─────────────────────────────────────────────────────
const counterOfferResponse = async (req, res) => {
  try {
    const { accept } = req.body; // true = accept counter, false = reject
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    if (accept) {
      ride.finalPrice = ride.counterOffer || ride.offeredPrice;
      ride.driver     = req.user._id;
      ride.status     = 'accepted';
      ride.acceptedAt = new Date();
      await ride.save();

      const driver = await Driver.findById(req.user._id);
      if (driver) { driver.currentRide = ride._id; await driver.save(); }

      res.json({ success: true, message: 'Counter-offer accepted. Ride started!', ride });
    } else {
      // Driver rejected the counter-offer — ride stays 'searching' for others
      ride.counterOffer = null;
      await ride.save();
      res.json({ success: true, message: 'Counter-offer rejected.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  GET /api/rides/:id/messages
//  Fetch in-ride chat messages
// ─────────────────────────────────────────────────────
const getMessages = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).select('messages');
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    res.json({ success: true, messages: ride.messages || [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  POST /api/rides/:id/messages
//  Post a chat message during a ride
// ─────────────────────────────────────────────────────
const postMessage = async (req, res) => {
  try {
    const { text, senderType } = req.body; // senderType: 'passenger' or 'driver'
    if (!text) return res.status(400).json({ message: 'Message text required.' });

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    if (!ride.messages) ride.messages = [];
    ride.messages.push({ text, senderType: senderType || 'passenger', createdAt: new Date() });
    await ride.save();

    res.json({ success: true, message: 'Message sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────
//  Auto-cancel stale rides stuck in 'searching' > 15 min
//  Called on server startup and every 5 minutes
// ─────────────────────────────────────────────────────
const cancelStaleRides = async () => {
  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const result = await Ride.updateMany(
      { status: 'searching', createdAt: { $lt: cutoff } },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'system' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`⏱  Auto-cancelled ${result.modifiedCount} stale ride(s).`);
    }
  } catch (err) {
    console.error('cancelStaleRides error:', err);
  }
};

module.exports = {
  requestRide,
  getPendingRides,
  acceptRide,
  getRideStatus,
  cancelRide,
  completeRide,
  counterOffer,
  counterOfferResponse,
  getMessages,
  postMessage,
  cancelStaleRides
};