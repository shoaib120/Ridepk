// js/socket-client.js — Passenger socket connection
let passengerSocket = null;

function connectPassengerSocket(userId, onEvent) {
  try {
    const base = (typeof API !== 'undefined') ? API.getBase() : 'https://ridepk.onrender.com';
    passengerSocket = io(base);
    passengerSocket.emit('user:join', { userId, role: 'passenger' });

    passengerSocket.on('driver:locationUpdate', (data) => { onEvent && onEvent('location', data); });
    passengerSocket.on('ride:driverFound',   (data) => { onEvent && onEvent('accepted', data); showToast('✅ ' + data.message); });
    passengerSocket.on('ride:counterOffer',  (data) => {
      onEvent && onEvent('counter', data);
      const accept = confirm(`Driver offered Rs. ${data.counterPrice}.\n\nAccept this price?`);
      if (passengerSocket) {
        passengerSocket.emit('ride:counterResponse', { rideId: data.rideId, driverId: data.driverId, accepted: accept });
      }
    });
    passengerSocket.on('ride:driverArrived', (data) => { onEvent && onEvent('arrived', data);   showToast('📍 Your driver has arrived!'); });
    passengerSocket.on('ride:tripStarted',   (data) => { onEvent && onEvent('started', data);   showToast('🚗 Your ride has started!'); });
    passengerSocket.on('ride:tripCompleted', (data) => { onEvent && onEvent('completed', data); showToast('🏁 Ride complete! Rs. ' + data.finalPrice); });
    passengerSocket.on('ride:tripCancelled', (data) => { onEvent && onEvent('cancelled', data); showToast('❌ ' + data.message); });
    passengerSocket.on('chat:receive',       (data) => { onEvent && onEvent('chat', data);      showToast('💬 ' + data.fromName + ': ' + data.message); });
  } catch (e) {
    console.log('Socket not available (backend not running)');
  }
}

function showToast(msg) {
  let t = document.getElementById('ridepk-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ridepk-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f1f1f;border:1px solid rgba(255,255,255,0.1);color:#f0ede8;padding:12px 24px;border-radius:10px;font-size:0.88rem;font-weight:500;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.4);transition:opacity 0.3s;white-space:nowrap;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 4000);
}
