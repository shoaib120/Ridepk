// scripts/testAPI.js — Test all API endpoints
// Run: node scripts/testAPI.js (while server is running)

const http = require('http');

function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost', port: 5000, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data  ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function log(label, res) {
  const ok = res.status >= 200 && res.status < 300;
  console.log(`${ok ? '✅' : '❌'} [${res.status}] ${label}`);
  if (!ok) console.log('   Error:', res.body?.message || res.body);
}

async function runTests() {
  console.log('\n🧪 Testing RidePK API v2.0...\n');

  let r = await apiCall('GET', '/');
  log('GET / — Health check', r);

  // Admin login
  r = await apiCall('POST', '/api/admin/login', { username: 'admin', password: 'RidePK@Admin2024' });
  log('POST /api/admin/login', r);
  const adminToken = r.body?.token;

  if (adminToken) {
    r = await apiCall('GET', '/api/admin/stats', null, adminToken);
    log('GET /api/admin/stats', r);
    console.log('   Stats:', JSON.stringify(r.body?.stats));

    r = await apiCall('GET', '/api/admin/drivers?status=pending', null, adminToken);
    log('GET /api/admin/drivers?status=pending', r);
    console.log(`   Pending drivers: ${r.body?.total || 0}`);
  }

  // Passenger register
  r = await apiCall('POST', '/api/auth/register', { name: 'Test User', phone: '0311-9999999', password: 'test123' });
  log('POST /api/auth/register', r);
  const pToken = r.body?.token;

  // Passenger login
  r = await apiCall('POST', '/api/auth/login', { phone: '0311-9999999', password: 'test123', role: 'passenger' });
  log('POST /api/auth/login (passenger)', r);

  // Driver login
  r = await apiCall('POST', '/api/auth/login', { phone: '0301-1111111', password: 'test123', role: 'driver' });
  log('POST /api/auth/login (driver)', r);
  const dToken = r.body?.token;

  // Nearby drivers
  r = await apiCall('GET', '/api/drivers/nearby?lat=31.5204&lng=74.3587');
  log('GET /api/drivers/nearby', r);
  console.log(`   Online drivers: ${r.body?.count || 0}`);

  // Create ride
  if (pToken) {
    r = await apiCall('POST', '/api/rides/create', {
      pickup:      { address: 'Gulberg, Lahore', coordinates: { lat: 31.512, lng: 74.358 } },
      destination: { address: 'DHA Lahore',      coordinates: { lat: 31.469, lng: 74.408 } },
      rideType: 'economy', distanceKm: 8.5, durationMin: 22,
      offeredPrice: 300, paymentMethod: 'Cash'
    }, pToken);
    log('POST /api/rides/create', r);
  }

  console.log('\n🎉 Tests complete! All ✅ = backend fully working.\n');
}

runTests().catch(console.error);
