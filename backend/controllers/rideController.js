// controllers/rideController.js  — fix22
// Matches the updated Ride.js schema:
//   - pickup.coordinates.lat/lng
//   - vehicleType field (required)
//   - offeredPrice (not estimatedFare)
//   - status: 'searching'
//   - passengerName / passengerPhone stored directly
// Added: cancelStaleRides (auto-cancel rides stuck in 'searching' > 15 min)

const Ride   = require('../models/Ride');
const Driver = require('../models/Driver');
const User   = require('../models/User');

// ============================================================
//  Vehicle matching
//  Driver.vehicle.type enum: 'car','suv','van','bike'
//  Ride vehicleType: 'motorbike' | 'rickshaw' | 'car'
// ============================================================
function vehicleMatchesRequest(driverType, requested) {
  if (requested === 'motorbike') return driverType === 'bike' || driverType === 'motorbike';
  if (requested === 'rickshaw')  return driverType === 'rickshaw';
  if (requested === 'car')       return ['car','suv','van'].includes(driverType);
  return false;
}

// ============================================================
//  POST /api/rides/request
// ============================================================
const requestRide = async (req, res) => {
  try {
    const {
      pickupAddress, pickupLat, pickupLng,
      destAddress,   destLat,   destLng,
      vehicleType,   estimatedFare, distanceKm, durationMin,
      passengerPhone, passengerName, counterOffer
    } = req.body;

    if (!pickupAddress || !pickupLat || !pickupLng)
      return res.status(400).json({ message: 'Pickup location is required.' });
    if (!destAddress || !destLat || !destLng)
      return res.status(400).json({ message: 'Destination is required.' });
    if (!vehicleType || !['motorbike','rickshaw','car'].includes(vehicleType))
      return res.status(400).json({ message: 'Vehicle type must be motorbike, rickshaw, or car.' });
    if (!req.user || !req.user._id)
      return res.status(401).json({ message: 'Please log in to book a ride.' });

    let passengerId = null;
    let pPhone      = passengerPhone || '';
    let pName       = passengerName  || '';

    try {
      const user = await User.findById(req.user._id).select('name phone');
      if (user) {
        passengerId = user._id;
        pPhone = user.phone || pPhone;
        pName  = (user.name && user.name.trim()) ? user.name.trim() : pName;
      }
    } catch (e) {}

    if (!passengerId)
      return res.status(401).json({ message: 'Please log in to book a ride.' });
    if (!pName) pName = pPhone ? ('Passenger (' + pPhone + ')') : 'Guest Passenger';

    const ride = await Ride.create({
      passenger:   passengerId,
      pickup: {
        address:     pickupAddress,
        coordinates: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) }
      },
      destination: {
        address:     destAddress,
        coordinates: { lat: parseFloat(destLat), lng: parseFloat(destLng) }
      },
      vehicleType:    vehicleType,
      rideType:       vehicleType === 'car' ? 'comfort' : 'economy',
      distanceKm:     parseFloat(distanceKm)  || 0,
      durationMin:    parseFloat(durationMin) || 0,
      offeredPrice:   parseFloat(estimatedFare) || 0,
      counterPrice:   (counterOffer && parseFloat(counterOffer) > 0) ? parseFloat(counterOffer) : null,
      passengerName:  pName,
      passengerPhone: pPhone,
      status: 'searching'
    });

    res.status(201).json({
      success: true,
      rideId:  ride._id,
      message: 'Ride request sent. Waiting for a driver to accept.'
    });
  } catch (err) {
    console.error('requestRide error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// ============================================================
//  GET /api/rides/pending
// ============================================================
const getPendingRides = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user._id).select('vehicle status isOnline subscription');
    if (!driver)                    return res.status(404).json({ message: 'Driver not found.' });
    if (driver.status !== 'approved') return res.status(403).json({ message: 'Your account is not approved.' });
    if (!driver.isOnline)           return res.json({ success: true, rides: [], message: 'Go online to receive requests.' });

    const sub = driver.subscription || {};
    const hasSubmitted = sub.paymentStatus === 'pending' || sub.paymentStatus === 'approved';
    const hasActive    = sub.isActive === true;
    if (!hasSubmitted && !hasActive) {
      return res.json({ success: true, rides: [], message: 'Subscribe to receive ride requests.' });
    }

    const allSearching = await Ride.find({ status: 'searching' })
      .sort({ createdAt: 1 }).limit(20).lean();

    const driverVehicleType = ((driver.vehicle && driver.vehicle.type) || 'car').toLowerCase();

    const matching = allSearching.filter(function(r) {
      return vehicleMatchesRequest(driverVehicleType, (r.vehicleType || '').toLowerCase());
    });

    const shaped = matching.map(function(r) {
      var displayFare = (r.counterPrice && r.counterPrice > 0) ? r.counterPrice : r.offeredPrice;
      return {
        _id:            r._id,
        pickup:         { address: r.pickup.address,      lat: r.pickup.coordinates.lat,      lng: r.pickup.coordinates.lng },
        destination:    { address: r.destination.address, lat: r.destination.coordinates.lat, lng: r.destination.coordinates.lng },
        vehicleType:    r.vehicleType,
        estimatedFare:  displayFare,
        offeredFare:    displayFare,
        originalFare:   r.offeredPrice,
        hasCounterOffer: !!(r.counterPrice && r.counterPrice > 0),
        distanceKm:     r.distanceKm,
        durationMin:    r.durationMin,
        passengerName:  r.passengerName  || '',
        passengerPhone: r.passengerPhone || '',
        status:         r.status,
        requestedAt:    r.createdAt
      };
    });

    res.json({ success: true, rides: shaped });
  } catch (err) {
    console.error('getPendingRides error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  PUT /api/rides/:id/accept
// ============================================================
const acceptRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    if (ride.status !== 'searching')
      return res.status(409).json({ message: 'This ride has already been ' + ride.status + '.' });

    const driver = await Driver.findById(req.user._id).select('-password');
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    ride.driver     = driver._id;
    ride.status     = 'accepted';
    ride.acceptedAt = new Date();
    ride.finalPrice = ride.counterPrice || ride.offeredPrice;
    await ride.save();

    driver.currentRide = ride._id;
    await driver.save();

    res.json({
      success: true,
      message: 'Ride accepted.',
      ride: {
        _id:            ride._id,
        pickup:         { address: ride.pickup.address,      lat: ride.pickup.coordinates.lat,      lng: ride.pickup.coordinates.lng },
        destination:    { address: ride.destination.address, lat: ride.destination.coordinates.lat, lng: ride.destination.coordinates.lng },
        vehicleType:    ride.vehicleType,
        estimatedFare:  ride.offeredPrice,
        offeredFare:    ride.offeredPrice,
        finalPrice:     ride.finalPrice,
        distanceKm:     ride.distanceKm,
        durationMin:    ride.durationMin,
        passengerPhone: ride.passengerPhone || '',
        passengerName:  ride.passengerName  || '',
        status:         ride.status
      },
      driver: {
        _id:      driver._id,
        fullName: driver.fullName,
        phone:    driver.phone,
        vehicle:  driver.vehicle,
        rating:   driver.rating
      }
    });
  } catch (err) {
    console.error('acceptRide error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  GET /api/rides/:id/status
// ============================================================
const getRideStatus = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('driver',    'fullName phone vehicle rating location')
      .populate('passenger', 'name phone');
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    res.json({
      success: true,
      status:  ride.status,
      ride: {
        _id:            ride._id,
        status:         ride.status,
        pickup:         { address: ride.pickup.address,      lat: ride.pickup.coordinates.lat,      lng: ride.pickup.coordinates.lng },
        destination:    { address: ride.destination.address, lat: ride.destination.coordinates.lat, lng: ride.destination.coordinates.lng },
        vehicleType:    ride.vehicleType,
        estimatedFare:  ride.offeredPrice,
        offeredFare:    ride.counterPrice || ride.offeredPrice,
        finalPrice:     ride.finalPrice,
        distanceKm:     ride.distanceKm,
        durationMin:    ride.durationMin,
        driver:         ride.driver || null,
        passengerName:  ride.passengerName  || (ride.passenger ? ride.passenger.name  : ''),
        passengerPhone: ride.passengerPhone || (ride.passenger ? ride.passenger.phone : ''),
        cancelledBy:    ride.cancelledBy,
        cancelReason:   ride.cancelReason,
        counterOfferStatus: ride.counterPrice ? 'pending' : null
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  PUT /api/rides/:id/cancel
// ============================================================
const cancelRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    if (['completed','cancelled'].includes(ride.status))
      return res.status(409).json({ message: 'Ride is already ' + ride.status + '.' });

    const reason      = (req.body && req.body.reason)      ? req.body.reason.trim()      : '';
    const cancelledBy = (req.body && req.body.cancelledBy) ? req.body.cancelledBy        : 'passenger';
    if (!reason)
      return res.status(400).json({ message: 'A cancellation reason is required.' });

    ride.status       = 'cancelled';
    ride.cancelledAt  = new Date();
    ride.cancelledBy  = ['passenger','driver'].includes(cancelledBy) ? cancelledBy : 'passenger';
    ride.cancelReason = reason;
    await ride.save();

    if (ride.driver)
      await Driver.findByIdAndUpdate(ride.driver, { currentRide: null });

    res.json({ success: true, message: 'Ride cancelled.', cancelledBy: ride.cancelledBy });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  PUT /api/rides/:id/complete
// ============================================================
const completeRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    const finalPrice = parseFloat(req.body.finalPrice) || ride.counterPrice || ride.offeredPrice || 0;
    ride.status      = 'completed';
    ride.completedAt = new Date();
    ride.finalPrice  = finalPrice;
    await ride.save();

    await Driver.findByIdAndUpdate(req.user._id, {
      currentRide: null,
      $inc: { totalEarnings: finalPrice, completedRides: 1 }
    });

    res.json({ success: true, message: 'Ride completed.', finalPrice });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  PUT /api/rides/:id/counter-offer
// ============================================================
const counterOffer = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    if (ride.status !== 'searching')
      return res.status(409).json({ message: 'Counter-offers can only be sent on pending rides.' });

    const offeredFare = parseFloat(req.body.offeredFare);
    if (isNaN(offeredFare) || offeredFare <= 0)
      return res.status(400).json({ message: 'Invalid offered fare.' });

    const minAllowed = ride.offeredPrice * 0.90;
    if (offeredFare < minAllowed)
      return res.status(400).json({ message: 'Minimum offer is Rs ' + Math.ceil(minAllowed) + '.' });
    if (offeredFare > ride.offeredPrice)
      return res.status(400).json({ message: 'Offer cannot exceed Rs ' + ride.offeredPrice + '.' });

    ride.counterPrice = offeredFare;
    await ride.save();

    res.json({ success: true, message: 'Counter-offer sent to driver.', offeredFare });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  PUT /api/rides/:id/counter-offer-response
// ============================================================
const counterOfferResponse = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    const { decision } = req.body;
    if (!['accept','reject'].includes(decision))
      return res.status(400).json({ message: 'Decision must be "accept" or "reject".' });

    if (decision === 'accept') {
      const driver = await Driver.findById(req.user._id).select('-password');
      if (!driver) return res.status(404).json({ message: 'Driver not found.' });

      ride.finalPrice = ride.counterPrice || ride.offeredPrice;
      ride.driver     = driver._id;
      ride.status     = 'accepted';
      ride.acceptedAt = new Date();
      await ride.save();

      driver.currentRide = ride._id;
      await driver.save();

      return res.json({ success: true, message: 'Counter-offer accepted. Ride confirmed at Rs ' + ride.finalPrice + '.', agreedFare: ride.finalPrice });
    } else {
      ride.counterPrice = null;
      await ride.save();
      return res.json({ success: true, message: 'Counter-offer rejected. Fare reset to Rs ' + ride.offeredPrice + '.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  GET /api/rides/:id/messages
// ============================================================
const getMessages = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).select('messages status');
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });

    let messages = ride.messages || [];

    const since = req.query.since;
    if (since) {
      const sinceDate = new Date(since);
      messages = messages.filter(function(m) { return new Date(m.sentAt) > sinceDate; });
    }

    res.json({ success: true, messages: messages, rideStatus: ride.status });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  POST /api/rides/:id/messages
// ============================================================
const postMessage = async (req, res) => {
  try {
    const { text, senderType } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'Message text is required.' });
    if (!['passenger', 'driver'].includes(senderType))
      return res.status(400).json({ message: 'senderType must be passenger or driver.' });

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    if (['completed', 'cancelled'].includes(ride.status))
      return res.status(409).json({ message: 'Cannot send messages on a ' + ride.status + ' ride.' });

    const msg = { senderType: senderType, text: text.trim(), sentAt: new Date() };
    ride.messages.push(msg);
    await ride.save();

    const saved = ride.messages[ride.messages.length - 1];
    res.json({ success: true, message: saved });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================================
//  AUTO-CANCEL: rides stuck in 'searching' for > 15 minutes
//  Called from server.js on startup and every 5 minutes.
// ============================================================
const cancelStaleRides = async () => {
  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
    const result = await Ride.updateMany(
      { status: 'searching', createdAt: { $lt: cutoff } },
      {
        $set: {
          status:       'cancelled',
          cancelledBy:  'system',
          cancelReason: 'No driver found within 15 minutes. Please try again.',
          cancelledAt:  new Date()
        }
      }
    );
    if (result.modifiedCount > 0) {
      console.log('[AutoCancel] Cancelled ' + result.modifiedCount + ' stale ride(s)');
    }
  } catch (err) {
    console.error('[AutoCancel] Error:', err.message);
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
