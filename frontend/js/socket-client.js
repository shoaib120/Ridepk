// frontend/js/socket-client.js
// CHANGES:
// 1. Handles ride:driverFound (shows driver phone)
// 2. Handles ride:remainingDistance (shows km left on map)
// 3. Handles ride:noDriver (4-min expiry)
// 4. Handles ride:taken (other drivers see request removed)
// 5. Driver auto-joins on login

const SOCKET_URL = window.RIDEPK_API_BASE || 'http://localhost:5000';

let passengerSocket = null;
let driverSocket    = null;

// =====================================================================
//  PASSENGER — connect socket, listen for events
// =====================================================================
function connectPassengerSocket(userId, eventCallback) {
  if (typeof io === 'undefined') {
    console.warn('Socket.io not loaded');
    return null;
  }

  passengerSocket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000
  });

  passengerSocket.on('connect', () => {
    console.log('🟢 Passenger socket connected:', passengerSocket.id);
    passengerSocket.emit('user:join', { userId, role: 'passenger' });
  });

  // Driver's live location update
  passengerSocket.on('driver:locationUpdate', (data) => {
    eventCallback && eventCallback('location', data);
  });

  // Remaining distance update (synced with driver)
  passengerSocket.on('ride:remainingDistance', (data) => {
    eventCallback && eventCallback('remainingDistance', data);
    // Also update map marker if we have the driver marker
    if (window.driverMarkers && data.driverId && driverMarkers[data.driverId]) {
      driverMarkers[data.driverId].setLatLng([data.driverLat, data.driverLng]);
    }
  });

  // Driver found and accepted
  passengerSocket.on('ride:driverFound', (data) => {
    eventCallback && eventCallback('accepted', data);
  });

  // Driver arrived at pickup
  passengerSocket.on('ride:driverArrived', (data) => {
    eventCallback && eventCallback('arrived', data);
  });

  // Trip started
  passengerSocket.on('ride:tripStarted', (data) => {
    eventCallback && eventCallback('started', data);
  });

  // Trip completed
  passengerSocket.on('ride:tripCompleted', (data) => {
    eventCallback && eventCallback('completed', data);
  });

  // Trip cancelled
  passengerSocket.on('ride:tripCancelled', (data) => {
    eventCallback && eventCallback('cancelled', data);
  });

  // Counter offer from driver
  passengerSocket.on('ride:counterOffer', (data) => {
    eventCallback && eventCallback('counterOffer', data);
  });

  // No driver found (4-min expiry)
  passengerSocket.on('ride:noDriver', (data) => {
    eventCallback && eventCallback('noDriver', data);
  });

  // Chat message received
  passengerSocket.on('chat:receive', (data) => {
    eventCallback && eventCallback('chat', data);
  });

  passengerSocket.on('disconnect', () => {
    console.log('🔴 Passenger socket disconnected');
  });

  passengerSocket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err.message);
  });

  return passengerSocket;
}

// =====================================================================
//  DRIVER — connect socket, listen for ride requests
// =====================================================================
function connectDriverSocket(userId, eventCallback) {
  if (typeof io === 'undefined') {
    console.warn('Socket.io not loaded');
    return null;
  }

  driverSocket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000
  });

  driverSocket.on('connect', () => {
    console.log('🟢 Driver socket connected:', driverSocket.id);
    // Join the driver's room
    driverSocket.emit('user:join', { userId, role: 'driver' });
    eventCallback && eventCallback('connected', {});
  });

  // New ride request coming in
  driverSocket.on('ride:request', (data) => {
    eventCallback && eventCallback('rideRequest', data);
  });

  // Ride was taken by another driver — remove from screen
  driverSocket.on('ride:taken', (data) => {
    eventCallback && eventCallback('rideTaken', data);
  });

  // Passenger accepted driver's counter offer
  driverSocket.on('ride:counterResult', (data) => {
    eventCallback && eventCallback('counterResult', data);
  });

  // Remaining distance from server
  driverSocket.on('ride:remainingDistance', (data) => {
    eventCallback && eventCallback('remainingDistance', data);
  });

  // Chat message
  driverSocket.on('chat:receive', (data) => {
    eventCallback && eventCallback('chat', data);
  });

  driverSocket.on('disconnect', () => {
    console.log('🔴 Driver socket disconnected');
    eventCallback && eventCallback('disconnected', {});
  });

  driverSocket.on('connect_error', (err) => {
    console.warn('Driver socket error:', err.message);
    eventCallback && eventCallback('error', { message: err.message });
  });

  return driverSocket;
}

// Helper: send driver location to server (call this every 4 seconds while driving)
function sendDriverLocation(driverId, lat, lng) {
  if (driverSocket && driverSocket.connected) {
    driverSocket.emit('driver:location', { driverId, lat, lng });
  }
}

// Helper: emit event from driver socket
function driverEmit(event, data) {
  if (driverSocket && driverSocket.connected) {
    driverSocket.emit(event, data);
  }
}

// Helper: emit event from passenger socket
function passengerEmit(event, data) {
  if (passengerSocket && passengerSocket.connected) {
    passengerSocket.emit(event, data);
  }
}
