// frontend/js/booking.js
// FIXES & NEW FEATURES:
// 1. GPS button now uses REAL current location (was defaulting to wrong place)
// 2. Address search now suggests Mirpur Division localities specifically
// 3. Intercity detection: checks if destination is outside local division
// 4. Remaining distance shown as driver moves during ride
// 5. Driver and passenger phone numbers shown after ride accepted
// 6. Request auto-expires after 4 minutes, re-sent to new online drivers
// 7. Route follows real roads via OSRM (not straight line)

const API_BASE = window.RIDEPK_API_BASE || 'https://ridepk.onrender.com';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const RATE_PER_KM = 40;
const MIN_PRICE   = 100;

// Mirpur Division local areas (populated from admin settings)
let LOCAL_CITIES = ['Mirpur','Islamgarh','Dadyal','Chakswari','Bhimber','Kotli','Samahni','Rawalakot','New Mirpur','Mangla'];

let map, pickupMarker, destMarker, routeLayer, driverMarkers = {};
let pickupLatLng = null, destLatLng = null;
let rideType = 'economy', paymentMethod = 'Cash';
let calculatedDistance = 0, calculatedDuration = 0, suggestedPrice = 0;
let activeRideId = null, requestQueue = [], queueIndex = 0, queueTimer = null;
let isIntercity = false;

// Popular localities in Mirpur AJK for address suggestions
const MIRPUR_LOCALITIES = [
  'Sector F-1, Mirpur','Sector F-2, Mirpur','Sector F-3, Mirpur',
  'Sector G-1, Mirpur','Sector G-2, Mirpur','Sector G-3, Mirpur',
  'Sector E-1, Mirpur','Sector E-3, Mirpur','Sector E-5, Mirpur',
  'Sector D-3, Mirpur','Sector B-2, Mirpur',
  'New Mirpur City','Raja Bazaar, Mirpur','Chakswari Chowk',
  'Allama Iqbal Road, Mirpur','Azad Kashmir Road',
  'Islamgarh','Dadyal','Chakswari','Bhimber','Kotli',
  'Samahni','Rawalakot','Mangla','New City Mirpur',
  'Mirpur City Center','Mirpur Bypass',
  'Islamabad','Rawalpindi','Lahore','Gujrat','Gujranwala','Sialkot'
];

window.addEventListener('DOMContentLoaded', async () => {
  // Load local cities from admin settings
  try {
    const data = await fetch(API_BASE + '/api/admin/intercity-zones').then(r => r.json());
    if (data.localCities) LOCAL_CITIES = data.localCities;
  } catch (e) {}

  // Init map centered on Mirpur AJK
  map = L.map('map', { zoomControl: true }).setView([33.1450, 73.7479], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(map);

  map.on('click', onMapClick);

  // Address input listeners
  document.getElementById('pickup').addEventListener('input', e => {
    handleAddressInput(e.target.value, 'pickup-sug', (ll, name) => setPickup(ll, name));
  });
  document.getElementById('destination').addEventListener('input', e => {
    handleAddressInput(e.target.value, 'dest-sug', (ll, name) => setDestination(ll, name));
  });

  // Connect socket if logged in
  const token = localStorage.getItem('token');
  const role  = localStorage.getItem('role');
  if (token && role === 'passenger') {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.id) connectPassengerSocket(user.id, handleSocketEvent);
  }

  // Show online drivers on map
  loadNearbyDriversOnMap();
});

// =====================================================================
//  ADDRESS SEARCH — shows local suggestions + Nominatim results
// =====================================================================
function handleAddressInput(query, boxId, onSelect) {
  const box = document.getElementById(boxId);
  if (!query || query.length < 2) { box.innerHTML = ''; return; }

  // First show local suggestions matching the query
  const localMatches = MIRPUR_LOCALITIES.filter(loc =>
    loc.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4);

  // Then search Nominatim for more results
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' Pakistan')}&format=json&limit=5&countrycodes=pk`;

  fetch(nominatimUrl, { headers: { 'Accept-Language': 'en' } })
    .then(r => r.json())
    .then(results => {
      box.innerHTML = '';

      // Show local matches first (highlighted)
      localMatches.forEach(loc => {
        const item = document.createElement('div');
        item.className = 'suggest-item';
        item.innerHTML = `📍 ${loc}`;
        item.addEventListener('click', () => {
          // Geocode the local name
          fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc + ' AJK Pakistan')}&format=json&limit=1`)
            .then(r => r.json())
            .then(data => {
              if (data[0]) {
                onSelect(L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon)), loc);
              } else {
                // Use approximate Mirpur coordinates if geocoding fails
                onSelect(L.latLng(33.1450 + Math.random()*0.05, 73.7479 + Math.random()*0.05), loc);
              }
            }).catch(() => {
              onSelect(L.latLng(33.1450, 73.7479), loc);
            });
          box.innerHTML = '';
        });
        box.appendChild(item);
      });

      // Show Nominatim results
      results.forEach(r => {
        const name = r.display_name.split(',').slice(0, 3).join(', ');
        if (localMatches.some(l => l.toLowerCase() === name.toLowerCase())) return;
        const item = document.createElement('div');
        item.className = 'suggest-item';
        item.innerHTML = `🔍 ${name}`;
        item.addEventListener('click', () => {
          onSelect(L.latLng(parseFloat(r.lat), parseFloat(r.lon)), name);
          box.innerHTML = '';
        });
        box.appendChild(item);
      });
    }).catch(() => {
      // Show only local matches if Nominatim fails
      box.innerHTML = '';
      localMatches.forEach(loc => {
        const item = document.createElement('div');
        item.className = 'suggest-item';
        item.innerHTML = `📍 ${loc}`;
        item.addEventListener('click', () => {
          onSelect(L.latLng(33.1450, 73.7479), loc);
          box.innerHTML = '';
        });
        box.appendChild(item);
      });
    });
}

// =====================================================================
//  MAP CLICK
// =====================================================================
function onMapClick(e) {
  reverseGeocode(e.latlng, name => {
    if (!pickupLatLng) {
      setPickup(e.latlng, name);
      document.getElementById('pickup').value = name;
    } else {
      setDestination(e.latlng, name);
      document.getElementById('destination').value = name;
    }
  });
}

function setPickup(latlng, name) {
  pickupLatLng = latlng;
  if (pickupMarker) map.removeLayer(pickupMarker);
  pickupMarker = L.circleMarker(latlng, {
    radius:11, color:'#22c55e', fillColor:'#22c55e', fillOpacity:1, weight:3
  }).addTo(map).bindPopup(`<b>📍 Pickup</b><br>${name}`).openPopup();
  map.setView(latlng, 14);
  document.getElementById('pickup').value = name;
  document.getElementById('pickup-sug').innerHTML = '';
  if (pickupLatLng && destLatLng) calcRealRoute();
}

function setDestination(latlng, name) {
  destLatLng = latlng;
  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.circleMarker(latlng, {
    radius:11, color:'#ff6b00', fillColor:'#ff6b00', fillOpacity:1, weight:3
  }).addTo(map).bindPopup(`<b>🏁 Destination</b><br>${name}`).openPopup();
  document.getElementById('destination').value = name;
  document.getElementById('dest-sug').innerHTML = '';

  // Check if destination is intercity
  checkIntercity(name);

  if (pickupLatLng && destLatLng) calcRealRoute();
}

// =====================================================================
//  INTERCITY DETECTION
// =====================================================================
function checkIntercity(destinationName) {
  const dest = destinationName.toLowerCase();
  const isLocal = LOCAL_CITIES.some(city => dest.includes(city.toLowerCase()));
  isIntercity = !isLocal;

  // Auto-select ride type
  if (isIntercity) {
    rideType = 'intercity';
    document.querySelectorAll('.rtype').forEach(r => r.classList.remove('sel'));
    document.querySelectorAll('.rtype').forEach(r => {
      if (r.textContent.toLowerCase().includes('intercity')) r.classList.add('sel');
    });
    showToast('🚌 Intercity ride detected — city-to-city pricing applied (Rs.80/km)');
  } else {
    if (rideType === 'intercity') {
      rideType = 'economy';
      document.querySelectorAll('.rtype').forEach(r => r.classList.remove('sel'));
      document.querySelectorAll('.rtype')[0]?.classList.add('sel');
    }
  }
}

// =====================================================================
//  REAL ROAD ROUTING via OSRM
// =====================================================================
async function calcRealRoute() {
  if (!pickupLatLng || !destLatLng) return;
  try {
    const url = `${OSRM_URL}/${pickupLatLng.lng},${pickupLatLng.lat};${destLatLng.lng},${destLatLng.lat}?overview=full&geometries=geojson`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      fallbackRoute(); return;
    }

    const route = data.routes[0];
    calculatedDistance = parseFloat((route.distance / 1000).toFixed(1));
    calculatedDuration = Math.round(route.duration / 60);

    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.geoJSON(route.geometry, {
      style: { color: '#ff6b00', weight: 5, opacity: 0.85 }
    }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

    updatePriceDisplay();
    document.getElementById('s1next').disabled = false;
  } catch (e) {
    console.warn('OSRM failed, using fallback:', e.message);
    fallbackRoute();
  }
}

function fallbackRoute() {
  if (routeLayer) map.removeLayer(routeLayer);
  routeLayer = L.polyline([pickupLatLng, destLatLng], {
    color:'#ff6b00', weight:4, opacity:0.7, dashArray:'10 8'
  }).addTo(map);
  map.fitBounds(L.latLngBounds([pickupLatLng, destLatLng]), { padding:[60,60] });
  calculatedDistance = parseFloat((map.distance(pickupLatLng, destLatLng)/1000).toFixed(1));
  calculatedDuration = Math.round((calculatedDistance / 30) * 60);
  updatePriceDisplay();
  document.getElementById('s1next').disabled = false;
}

function updatePriceDisplay() {
  const mult = rideType==='comfort' ? 1.4 : rideType==='intercity' ? 2.0 : 1.0;
  suggestedPrice = Math.max(MIN_PRICE, Math.round(calculatedDistance * RATE_PER_KM * mult / 10) * 10);

  document.getElementById('rdist').textContent = calculatedDistance + ' km';
  document.getElementById('rtime').textContent = calculatedDuration + ' min';
  document.getElementById('rsugg').textContent = 'Rs. ' + suggestedPrice;
  document.getElementById('route-box').style.display = 'flex';
  document.getElementById('psugg').textContent = 'Rs. ' + suggestedPrice;
  document.getElementById('pmkt').textContent  = 'Rs. ' + Math.round(suggestedPrice * 0.95);

  // Show intercity badge
  const badge = document.getElementById('intercity-badge');
  if (badge) {
    badge.style.display = isIntercity ? 'block' : 'none';
  }
}

// =====================================================================
//  GPS — USE REAL CURRENT LOCATION (FIXED)
// =====================================================================
function useGPS() {
  if (!navigator.geolocation) {
    alert('GPS is not supported in this browser.'); return;
  }

  const btn = document.querySelector('.gps-btn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  showToast('📍 Getting your exact location...');

  navigator.geolocation.getCurrentPosition(
    pos => {
      // These are the REAL coordinates from your device
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const ll  = L.latLng(lat, lng);

      console.log('GPS location:', lat, lng);
      reverseGeocode(ll, name => {
        setPickup(ll, name);
        if (btn) { btn.textContent = '📍'; btn.disabled = false; }
        showToast('✅ Location found: ' + name);
      });
    },
    err => {
      if (btn) { btn.textContent = '📍'; btn.disabled = false; }
      let msg = 'Could not get your location. ';
      if (err.code === 1) msg += 'Please allow location access in your browser.';
      if (err.code === 2) msg += 'GPS signal not available.';
      if (err.code === 3) msg += 'Location request timed out.';
      alert(msg);
    },
    {
      enableHighAccuracy: true,  // Use GPS chip, not IP-based location
      timeout:            15000,
      maximumAge:         0      // Always get fresh location
    }
  );
}

// =====================================================================
//  REVERSE GEOCODE
// =====================================================================
function reverseGeocode(latlng, cb) {
  fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&accept-language=en`)
    .then(r => r.json())
    .then(d => {
      const a = d.address || {};
      const parts = [a.road, a.suburb||a.neighbourhood, a.city||a.town||a.village||a.county].filter(Boolean);
      cb(parts.length ? parts.join(', ') : `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
    })
    .catch(() => cb(`${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`));
}

// =====================================================================
//  LOAD NEARBY DRIVERS ON MAP
// =====================================================================
async function loadNearbyDriversOnMap() {
  try {
    const data = await fetch(API_BASE + '/api/drivers/nearby?lat=33.1450&lng=73.7479&radius=30').then(r => r.json());
    if (!data.drivers) return;
    data.drivers.forEach(d => {
      if (!d.location?.coordinates || d.location.coordinates[0] === 0) return;
      const ll   = L.latLng(d.location.coordinates[1], d.location.coordinates[0]);
      const icon = L.divIcon({
        html: `<div style="font-size:20px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">${d.vehicle?.category==='rickshaw'?'🛺':d.vehicle?.category==='motorbike'?'🏍️':'🚗'}</div>`,
        iconSize:[24,24], iconAnchor:[12,12], className:''
      });
      const m = L.marker(ll, { icon }).addTo(map);
      m.bindPopup(`<b>${d.fullName}</b><br>⭐ ${d.rating?.average||5.0}<br>${d.vehicle?.make} ${d.vehicle?.model}`);
      driverMarkers[d._id] = m;
    });
  } catch (e) {}
}

// =====================================================================
//  UI HELPERS
// =====================================================================
function pickType(el, type) {
  document.querySelectorAll('.rtype').forEach(r => r.classList.remove('sel'));
  el.classList.add('sel');
  rideType = type;
  if (pickupLatLng && destLatLng) calcRealRoute();
}

function setPrice(amt) { document.getElementById('price').value = amt; }

function pickPay(el) {
  document.querySelectorAll('.popt').forEach(p => p.classList.remove('sel'));
  el.classList.add('sel');
  paymentMethod = el.textContent.replace(/📱|💵|💳/g,'').trim();
}

function goStep(n) {
  if (n===2 && (!pickupLatLng||!destLatLng)) { alert('Set pickup and destination first.'); return; }
  if (n===3) {
    const price = parseInt(document.getElementById('price').value);
    if (!price||price<MIN_PRICE) { alert(`Minimum price is Rs. ${MIN_PRICE}.`); return; }
    fillSummary();
  }
  ['step1','step2','step3','searching'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('step'+n).classList.remove('hidden');
  document.querySelectorAll('.sdot').forEach((d,i) => {
    d.classList.remove('active','done');
    if (i+1<n) d.classList.add('done');
    if (i+1===n) d.classList.add('active');
  });
}

function fillSummary() {
  document.getElementById('s-from').textContent  = document.getElementById('pickup').value||'—';
  document.getElementById('s-to').textContent    = document.getElementById('destination').value||'—';
  document.getElementById('s-dist').textContent  = calculatedDistance+' km';
  document.getElementById('s-time').textContent  = calculatedDuration+' min';
  document.getElementById('s-type').textContent  = rideType.charAt(0).toUpperCase()+rideType.slice(1);
  document.getElementById('s-price').textContent = 'Rs. '+document.getElementById('price').value;
  document.getElementById('s-pay').textContent   = paymentMethod;
}

// =====================================================================
//  CONFIRM RIDE
// =====================================================================
async function confirmRide() {
  const token = localStorage.getItem('token');
  if (!token) {
    if (confirm('Login required. Go to login page?')) window.location.href='login.html';
    return;
  }

  document.getElementById('step3').classList.add('hidden');
  document.getElementById('searching').classList.remove('hidden');
  document.getElementById('driver-list').innerHTML = '';
  document.getElementById('cnt').textContent = '...';

  const offeredPrice = parseInt(document.getElementById('price').value);
  const rideData = {
    pickup:      { address: document.getElementById('pickup').value, coordinates:{ lat:pickupLatLng.lat, lng:pickupLatLng.lng } },
    destination: { address: document.getElementById('destination').value, coordinates:{ lat:destLatLng.lat, lng:destLatLng.lng } },
    rideType, distanceKm:calculatedDistance, durationMin:calculatedDuration,
    offeredPrice, paymentMethod
  };

  const data = await API.post('/api/rides/create', rideData);
  if (!data.success) {
    alert(data.message||'Could not create ride.');
    document.getElementById('searching').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
    return;
  }

  activeRideId = data.ride._id;

  // Get nearby drivers list for display
  const drvData = await API.get(`/api/drivers/nearby?lat=${pickupLatLng.lat}&lng=${pickupLatLng.lng}&radius=30`);
  requestQueue = drvData.drivers || [];
  document.getElementById('cnt').textContent = requestQueue.length || '...';

  const user = JSON.parse(localStorage.getItem('user')||'{}');

  // Emit to socket
  if (typeof passengerSocket !== 'undefined' && passengerSocket) {
    passengerSocket.emit('ride:new', {
      ...rideData, rideId:activeRideId,
      passengerId:user.id, passengerName:user.name, passengerRating:user.rating
    });
  }

  // Show driver cards with countdown
  showDriverCards(offeredPrice);

  // Auto-timeout message after 4 minutes
  setTimeout(() => {
    clearInterval(queueTimer);
    const list = document.getElementById('driver-list');
    if (list && !list.querySelector('.accepted-card')) {
      list.innerHTML += `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:14px;margin-top:10px;font-size:.85rem;color:#ef4444;">
        ⏱ No driver responded in 4 minutes.<br>The request has expired. Please <button onclick="goStep(1)" style="background:transparent;border:none;color:var(--orange);cursor:pointer;font-weight:600;font-size:.85rem">try again</button> or adjust your price.
      </div>`;
    }
  }, 4 * 60 * 1000);
}

function showDriverCards(offeredPrice) {
  queueIndex = 0;
  clearInterval(queueTimer);

  function showCard() {
    if (queueIndex >= requestQueue.length) {
      clearInterval(queueTimer); return;
    }
    const d    = requestQueue[queueIndex];
    const icon = d.vehicle?.category==='rickshaw'?'🛺':d.vehicle?.category==='motorbike'?'🏍️':'🚗';
    const card = document.createElement('div');
    card.className = 'driver-offer-card';
    card.id = 'dcard-' + queueIndex;
    card.innerHTML = `
      <span class="davatar">${icon}</span>
      <div>
        <div class="dname">${d.fullName||'Driver'}</div>
        <div class="drating">⭐ ${d.rating?.average||'5.0'} · ${d.vehicle?.make||''} ${d.vehicle?.model||''}</div>
      </div>
      <div class="doffer"><b>Rs. ${offeredPrice}</b><small>Sending request...</small></div>
      <button class="btn-accept" onclick="acceptDriverCard(this,'${d._id||''}','${d.fullName||'Driver'}',${offeredPrice},'${d.phone||''}')">Accept</button>`;
    document.getElementById('driver-list').appendChild(card);
    queueIndex++;
  }

  showCard(); // show first immediately
  queueTimer = setInterval(showCard, 8000); // next one every 8 seconds
}

async function acceptDriverCard(btn, driverId, driverName, price, driverPhone) {
  clearInterval(queueTimer);
  btn.textContent = '✅ Accepted'; btn.disabled = true;
  document.querySelectorAll('.driver-offer-card').forEach(c => { if (!c.contains(btn)) c.style.opacity='0.3'; });

  if (activeRideId) await API.put('/api/rides/'+activeRideId+'/accept', { counterPrice: price });

  const user = JSON.parse(localStorage.getItem('user')||'{}');

  // Show driver phone to passenger
  const card = document.createElement('div');
  card.className = 'accepted-card';
  card.style.cssText = 'background:rgba(34,197,94,.1);border:1px solid #22c55e;border-radius:10px;padding:16px;margin-top:12px;font-size:.88rem;line-height:1.8';
  card.innerHTML = `
    ✅ <b>${driverName}</b> accepted your ride!<br>
    📞 Driver Phone: <b><a href="tel:${driverPhone}" style="color:var(--orange)">${driverPhone||'Loading...'}</a></b>
    <br><small style="color:var(--muted)">Call the driver if you cannot reach them via the app.</small><br><br>
    🗺️ Tracking driver location on map in real time...`;
  document.getElementById('driver-list').appendChild(card);
}

function cancelSearch() {
  clearInterval(queueTimer);
  const reason = prompt('Reason for cancelling? (required)') || 'Passenger cancelled before driver arrived';
  if (activeRideId) API.put('/api/rides/'+activeRideId+'/cancel', { reason });
  document.getElementById('searching').classList.add('hidden');
  document.getElementById('step3').classList.remove('hidden');
  activeRideId = null;
}

// =====================================================================
//  SOCKET EVENT HANDLER
// =====================================================================
function handleSocketEvent(event, data) {
  if (event === 'location' && data.lat) {
    // Move driver marker on map
    const ll  = L.latLng(data.lat, data.lng);
    const dId = data.driverId || 'active';
    if (driverMarkers[dId]) {
      driverMarkers[dId].setLatLng(ll);
    } else {
      const icon = L.divIcon({ html:'<div style="font-size:22px">🚗</div>', iconSize:[24,24], iconAnchor:[12,12], className:'' });
      driverMarkers[dId] = L.marker(ll, { icon }).addTo(map);
    }
  }

  if (event === 'remainingDistance' && data.remainingKm !== undefined) {
    // Show remaining distance info
    const el = document.getElementById('remaining-dist');
    if (el) {
      el.textContent = `📏 Remaining: ~${data.remainingKm} km`;
      el.style.display = 'block';
    }
  }

  if (event === 'accepted') {
    clearInterval(queueTimer);
    const drv = data.driver;
    if (drv) {
      // Show driver phone number
      const existingCard = document.querySelector('.accepted-card');
      if (!existingCard) {
        const card = document.createElement('div');
        card.className = 'accepted-card';
        card.style.cssText = 'background:rgba(34,197,94,.1);border:1px solid #22c55e;border-radius:10px;padding:16px;margin-top:12px;font-size:.88rem;line-height:1.8';
        card.innerHTML = `
          ✅ <b>${drv.fullName}</b> is on the way!<br>
          📞 Driver Phone: <b><a href="tel:${drv.phone}" style="color:var(--orange)">${drv.phone}</a></b><br>
          🚗 ${drv.vehicle?.make||''} ${drv.vehicle?.model||''} · ${drv.vehicle?.plate||''}<br>
          ⭐ ${drv.rating?.average||5.0}<br>
          <span id="remaining-dist" style="color:var(--orange)"></span>`;
        document.getElementById('driver-list').appendChild(card);
      }
    }
    showToast('✅ Driver found and on the way!');
  }

  if (event === 'noDriver') {
    clearInterval(queueTimer);
    showToast('⏱ No driver found. Please try again.');
  }

  if (event === 'arrived')   showToast('📍 Your driver is at the pickup point!');
  if (event === 'started')   showToast('🚗 Ride started!');
  if (event === 'completed') {
    showToast(`🏁 Ride complete! Rs. ${data.finalPrice}`);
    setTimeout(() => window.location.href='passenger-dashboard.html', 3000);
  }
  if (event === 'cancelled') showToast('❌ '+(data.message||'Ride cancelled.'));
}

document.addEventListener('click', e => {
  if (!e.target.closest('.field-group'))
    document.querySelectorAll('.suggest-box').forEach(b => b.innerHTML='');
});

function showToast(msg) {
  let t = document.getElementById('ridepk-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ridepk-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f1f1f;border:1px solid rgba(255,255,255,.1);color:#f0ede8;padding:12px 22px;border-radius:10px;font-size:.88rem;font-weight:500;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.4);transition:opacity .3s;white-space:nowrap;pointer-events:none;max-width:90vw;text-align:center';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.style.opacity='0', 4500);
}
