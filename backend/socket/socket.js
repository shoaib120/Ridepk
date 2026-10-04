// socket/socket.js
// FIXES:
// 1. Driver receives ride requests properly (was not firing correctly)
// 2. Both driver and passenger see remaining distance as ride progresses
// 3. Ride request re-sent to newly online drivers
// 4. Phone numbers shared after ride is accepted
// 5. Active ride request removed from map when accepted

const { Server } = require('socket.io');
const Driver = require('../models/Driver');
const Ride   = require('../models/Ride');

const connectedUsers = {};    // userId -> socketId
const activeRequests = {};    // rideId -> { rideData, sentTo: Set, acceptedBy: null }

const initSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET','POST'] },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log(`⚡ Socket connected: ${socket.id}`);

    // =====================================================
    //  USER JOINS — both passenger and driver call this
    // =====================================================
    socket.on('user:join', async ({ userId, role }) => {
      connectedUsers[userId] = socket.id;
      socket.userId = userId;
      socket.role   = role;
      socket.join(`user:${userId}`);
      console.log(`👤 ${role} joined: ${userId}`);

      // If a driver just came online, check if any active requests should be sent to them
      if (role === 'driver') {
        try {
          const driver = await Driver.findById(userId);
          if (driver && driver.isOnline && !driver.currentRide && driver.status === 'approved') {
            // Send any active ride requests this driver hasn't seen yet
            Object.entries(activeRequests).forEach(([rideId, req]) => {
              if (!req.acceptedBy && !req.sentTo.has(userId)) {
                socket.emit('ride:request', req.rideData);
                req.sentTo.add(userId);
                console.log(`📤 Sent pending ride ${rideId} to newly online driver ${userId}`);
              }
            });
          }
        } catch (e) {}
      }
    });

    // =====================================================
    //  DRIVER SENDS GPS LOCATION — every 4 seconds
    // =====================================================
    socket.on('driver:location', async ({ driverId, lat, lng }) => {
      try {
        // Update DB
        await Driver.findByIdAndUpdate(driverId, {
          location: { type: 'Point', coordinates: [lng, lat] }
        });

        // Find active ride for this driver
        const activeRide = await Ride.findOne({
          driver: driverId,
          status: { $in: ['accepted','driver_arrived','in_progress'] }
        });

        if (activeRide) {
          // Send driver location to passenger
          io.to(`user:${activeRide.passenger}`).emit('driver:locationUpdate', {
            lat, lng, rideId: activeRide._id, driverId
          });

          // Calculate remaining distance (straight line as reference)
          // Real remaining distance shown in frontend via re-routing
          const targetLat = activeRide.status === 'in_progress'
            ? activeRide.destination.coordinates.lat
            : activeRide.pickup.coordinates.lat;
          const targetLng = activeRide.status === 'in_progress'
            ? activeRide.destination.coordinates.lng
            : activeRide.pickup.coordinates.lng;

          const remainingKm = calcDistance(lat, lng, targetLat, targetLng);

          // Broadcast remaining distance to both driver and passenger
          io.to(`user:${activeRide.passenger}`).emit('ride:remainingDistance', {
            remainingKm: parseFloat(remainingKm.toFixed(1)),
            driverLat: lat,
            driverLng: lng,
            rideStatus: activeRide.status,
            rideId: activeRide._id
          });
          io.to(`user:${driverId}`).emit('ride:remainingDistance', {
            remainingKm: parseFloat(remainingKm.toFixed(1)),
            driverLat: lat,
            driverLng: lng,
            rideStatus: activeRide.status,
            rideId: activeRide._id
          });
        }
      } catch (err) {
        console.error('Location update error:', err.message);
      }
    });

    // =====================================================
    //  NEW RIDE REQUEST — passenger posts a ride
    // =====================================================
    socket.on('ride:new', async (rideData) => {
      try {
        const { rideId, passengerId, pickup } = rideData;

        // Store the active request
        activeRequests[rideId] = {
          rideData,
          sentTo:     new Set(),
          acceptedBy: null,
          createdAt:  Date.now()
        };

        // Get all online approved drivers (sorted by proximity if coords available)
        const drivers = await Driver.find({
          isOnline:   true,
          status:     'approved',
          isFrozen:   false,
          currentRide: null
        }).select('_id location');

        console.log(`🚕 New ride ${rideId} — sending to ${drivers.length} online drivers`);

        // Send to all online drivers immediately
        drivers.forEach(driver => {
          const dId = driver._id.toString();
          if (connectedUsers[dId]) {
            io.to(`user:${dId}`).emit('ride:request', rideData);
            activeRequests[rideId].sentTo.add(dId);
          }
        });

        // Auto-expire the request after 4 minutes
        setTimeout(async () => {
          if (activeRequests[rideId] && !activeRequests[rideId].acceptedBy) {
            delete activeRequests[rideId];
            // Notify passenger that no driver was found
            io.to(`user:${passengerId}`).emit('ride:noDriver', {
              rideId,
              message: 'No driver accepted in time. Please try again or adjust your price.'
            });
            // Cancel the ride in DB
            try {
              await Ride.findByIdAndUpdate(rideId, {
                status: 'cancelled',
                cancelledBy: 'system',
                cancelReason: 'No driver found within 4 minutes'
              });
            } catch (e) {}
            console.log(`⏱ Ride ${rideId} expired — no driver accepted`);
          }
        }, 4 * 60 * 1000); // 4 minutes

      } catch (err) {
        console.error('ride:new error:', err.message);
      }
    });

    // =====================================================
    //  DRIVER ACCEPTS RIDE
    // =====================================================
    socket.on('ride:accepted', ({ rideId, passengerId, driverInfo }) => {
      // Mark as accepted so other drivers stop seeing it
      if (activeRequests[rideId]) {
        activeRequests[rideId].acceptedBy = socket.userId;
      }

      // Tell ALL online drivers to remove this request from their screen
      Object.values(connectedUsers).forEach(sid => {
        io.to(sid).emit('ride:taken', { rideId });
      });

      // Tell the passenger their driver is coming
      // Include driver phone so passenger can call if needed
      io.to(`user:${passengerId}`).emit('ride:driverFound', {
        rideId,
        driver: driverInfo,
        message: `Driver ${driverInfo.fullName} accepted your ride!`
      });

      console.log(`✅ Ride ${rideId} accepted by driver ${socket.userId}`);
    });

    // =====================================================
    //  DRIVER COUNTER OFFER
    // =====================================================
    socket.on('ride:counter', ({ rideId, passengerId, counterPrice, driverId }) => {
      io.to(`user:${passengerId}`).emit('ride:counterOffer', {
        rideId, counterPrice, driverId,
        message: `Driver offered Rs. ${counterPrice}`
      });
    });

    socket.on('ride:counterResponse', ({ rideId, driverId, accepted, finalPrice }) => {
      io.to(`user:${driverId}`).emit('ride:counterResult', {
        rideId, accepted, finalPrice,
        message: accepted ? `✅ Passenger accepted Rs. ${finalPrice}!` : '❌ Passenger declined your offer.'
      });
    });

    // =====================================================
    //  RIDE STATUS UPDATES
    // =====================================================
    socket.on('ride:arrived', ({ rideId, passengerId }) => {
      io.to(`user:${passengerId}`).emit('ride:driverArrived', {
        rideId,
        message: '🚗 Your driver has arrived at the pickup point!'
      });
    });

    socket.on('ride:started', ({ rideId, passengerId }) => {
      io.to(`user:${passengerId}`).emit('ride:tripStarted', {
        rideId,
        message: '✅ Your ride has started!'
      });
    });

    socket.on('ride:completed', ({ rideId, passengerId, finalPrice }) => {
      io.to(`user:${passengerId}`).emit('ride:tripCompleted', {
        rideId, finalPrice,
        message: `🏁 Ride complete! Total: Rs. ${finalPrice}`
      });
      // Clean up active request
      delete activeRequests[rideId];
    });

    socket.on('ride:cancelled', ({ rideId, cancelledBy, otherUserId, reason }) => {
      io.to(`user:${otherUserId}`).emit('ride:tripCancelled', {
        rideId, cancelledBy, reason,
        message: cancelledBy === 'driver'
          ? `❌ Driver cancelled the ride. Reason: ${reason || 'No reason given'}`
          : `❌ Passenger cancelled the ride. Reason: ${reason || 'No reason given'}`
      });
      delete activeRequests[rideId];
    });

    // =====================================================
    //  CHAT — between driver and passenger during ride
    // =====================================================
    socket.on('chat:message', ({ toId, fromName, message, rideId }) => {
      io.to(`user:${toId}`).emit('chat:receive', {
        fromName, message, rideId,
        time: new Date().toISOString()
      });
    });

    // =====================================================
    //  DISCONNECT
    // =====================================================
    socket.on('disconnect', async () => {
      console.log(`⚡ Socket disconnected: ${socket.id}`);
      if (socket.userId) {
        delete connectedUsers[socket.userId];
        // If driver disconnects, mark offline in DB
        if (socket.role === 'driver') {
          await Driver.findByIdAndUpdate(socket.userId, { isOnline: false }).catch(() => {});
          console.log(`🔴 Driver ${socket.userId} went offline`);
        }
      }
    });
  });

  // Periodically clean up expired requests older than 5 min
  setInterval(() => {
    const now = Date.now();
    Object.entries(activeRequests).forEach(([rideId, req]) => {
      if (now - req.createdAt > 5 * 60 * 1000 && !req.acceptedBy) {
        delete activeRequests[rideId];
        console.log(`🧹 Cleaned up expired ride request: ${rideId}`);
      }
    });
  }, 60 * 1000);

  return io;
};

// Helper: calculate distance in km between two lat/lng points
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
            Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

module.exports = initSocket;
