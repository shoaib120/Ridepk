// =====================================================
//  backend/config/rideMailer.js
//  Ride-related transactional emails for RidePK
//  Uses Brevo HTTP API (bypasses SMTP firewall on Render)
// =====================================================

const https = require('https');

// ── Send via Brevo HTTP API ─────────────────────────
function sendBrevoEmail({ to, toName, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const fromEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER;
    const fromName  = 'RidePK';
    const apiKey    = process.env.BREVO_API_KEY;

    if (!apiKey) {
      return reject(new Error('BREVO_API_KEY not set'));
    }

    const body = JSON.stringify({
      sender:      { name: fromName, email: fromEmail },
      to:          [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
      textContent: text || ''
    });

    const options = {
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers: {
        'accept':         'application/json',
        'api-key':        apiKey,
        'content-type':   'application/json',
        'content-length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Brevo API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const BASE          = (process.env.FRONTEND_URL || 'https://ridepk-frontend.vercel.app').replace(/\/$/, '');
const LOGIN_URL     = BASE + '/frontend/login.html';
const DRIVER_URL    = BASE + '/frontend/driver-login.html';
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL || '';

// ── Brand colours ──────────────────────────────────────
const ORANGE = '#ff6b00';
const DARK   = '#1a1a2e';

// ── Shared HTML wrapper ─────────────────────────────────
function wrap(title, body) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:30px 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:100%">
        <tr><td style="background:${DARK};padding:22px 30px">
          <span style="font-size:1.3rem;font-weight:800;color:#fff;letter-spacing:-0.5px">🚗 Ride<span style="color:${ORANGE}">PK</span></span>
          <span style="display:block;color:#a0a0b8;font-size:0.78rem;margin-top:2px">Mirpur AJK — Pakistan</span>
        </td></tr>
        <tr><td style="padding:28px 30px 10px">${body}</td></tr>
        <tr><td style="padding:16px 30px 26px;border-top:1px solid #f0f0f0;color:#a0a0b8;font-size:0.75rem;text-align:center">
          This is an automated message from RidePK. Please do not reply to this email.<br>
          © 2026 RidePK — Mirpur AJK
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(url, label) {
  return `<a href="${url}" style="display:inline-block;background:${ORANGE};color:#fff;padding:11px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.92rem;margin:14px 0">${label}</a>`;
}
function h1(text)  { return `<h2 style="margin:0 0 10px;color:#1a1a2e;font-size:1.15rem">${text}</h2>`; }
function p(text)   { return `<p  style="margin:0 0 12px;color:#444;font-size:0.9rem;line-height:1.6">${text}</p>`; }

function rideTable(ride) {
  const p = ride.passenger || {};
  const d = ride.driver    || {};
  return `
  <table style="background:#f8f8fc;border-radius:8px;padding:14px 18px;margin:12px 0 18px;width:100%;border-collapse:collapse">
    <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Pickup</td>      <td style="font-weight:600;font-size:0.85rem">${ride.pickup        || '—'}</td></tr>
    <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Destination</td> <td style="font-weight:600;font-size:0.85rem">${ride.destination   || '—'}</td></tr>
    <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Ride Type</td>   <td style="font-weight:600;font-size:0.85rem">${ride.rideType      || '—'}</td></tr>
    <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Price</td>       <td style="font-weight:600;font-size:0.85rem">Rs. ${ride.offeredPrice || '—'}</td></tr>
    <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Payment</td>     <td style="font-weight:600;font-size:0.85rem">${ride.paymentMethod  || '—'}</td></tr>
    ${p.name ? `<tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Passenger</td><td style="font-weight:600;font-size:0.85rem">${p.name} · ${p.phone || ''}</td></tr>` : ''}
    ${d.fullName ? `<tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Driver</td><td style="font-weight:600;font-size:0.85rem">${d.fullName} · ${d.phone || ''}</td></tr>` : ''}
  </table>`;
}

// ─────────────────────────────────────────────────────────
//  1. RIDE ACCEPTED — passenger notification
// ─────────────────────────────────────────────────────────
async function sendRideAcceptedEmail(ride) {
  const passenger = ride.passenger || {};
  if (!passenger.email) return;
  try {
    const driver = ride.driver || {};
    const subject = `RidePK — Your ride has been accepted!`;
    const html = wrap(subject, `
      ${h1('🟢 Ride Accepted!')}
      ${p(`Hi <strong>${passenger.name || 'Passenger'}</strong>, a driver has accepted your ride request.`)}
      ${rideTable(ride)}
      <div style="background:#f0fff4;border:1px solid #22c55e44;border-radius:8px;padding:14px 18px;margin:12px 0 16px">
        <p style="margin:0;color:#166534;font-size:0.88rem;font-weight:600">🚗 Your Driver</p>
        <p style="margin:6px 0 0;color:#444;font-size:0.85rem">
          <strong>${driver.fullName || '—'}</strong><br>
          📞 ${driver.phone || '—'}<br>
          ${driver.vehicle ? `🚗 ${driver.vehicle.make || ''} ${driver.vehicle.model || ''} — <strong>${driver.vehicle.plate || ''}</strong>` : ''}
        </p>
      </div>
      ${btn(LOGIN_URL, '📍 Track Your Ride')}
    `);
    await sendBrevoEmail({ to: passenger.email, toName: passenger.name, subject, html,
      text: `Hi ${passenger.name}, your ride has been accepted by ${driver.fullName || 'a driver'} (${driver.phone || ''}). Pickup: ${ride.pickup}` });
    console.log('✅ Ride accepted email sent to passenger:', passenger.email);
  } catch (err) {
    console.error('❌ Ride accepted email error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  2. RIDE COMPLETED — passenger + driver notification
// ─────────────────────────────────────────────────────────
async function sendRideCompletedEmail(ride) {
  const passenger = ride.passenger || {};
  const driver    = ride.driver    || {};

  // Email to passenger
  if (passenger.email) {
    try {
      const subject = `RidePK — Ride Completed`;
      const html = wrap(subject, `
        ${h1('✅ Ride Completed!')}
        ${p(`Hi <strong>${passenger.name || 'Passenger'}</strong>, your ride has been completed successfully.`)}
        ${rideTable(ride)}
        ${p('Thank you for choosing RidePK. We hope you had a great experience!')}
        ${btn(LOGIN_URL, '⭐ Rate Your Ride')}
      `);
      await sendBrevoEmail({ to: passenger.email, toName: passenger.name, subject, html,
        text: `Hi ${passenger.name}, your ride from ${ride.pickup} to ${ride.destination} is completed. Amount: Rs. ${ride.offeredPrice}.` });
      console.log('✅ Ride completed email sent to passenger:', passenger.email);
    } catch (err) {
      console.error('❌ Ride completed email (passenger) error:', err.message);
    }
  }

  // Email to driver
  if (driver.email) {
    try {
      const subject = `RidePK — Ride Completed`;
      const html = wrap(subject, `
        ${h1('✅ Ride Completed!')}
        ${p(`Hi <strong>${driver.fullName || 'Driver'}</strong>, the ride has been completed.`)}
        ${rideTable(ride)}
        ${p('Great work! Keep driving and earning with RidePK.')}
        ${btn(DRIVER_URL, '🚗 Dashboard')}
      `);
      await sendBrevoEmail({ to: driver.email, toName: driver.fullName, subject, html,
        text: `Hi ${driver.fullName}, ride from ${ride.pickup} to ${ride.destination} completed. Fare: Rs. ${ride.offeredPrice}.` });
      console.log('✅ Ride completed email sent to driver:', driver.email);
    } catch (err) {
      console.error('❌ Ride completed email (driver) error:', err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────
//  3. RIDE CANCELLED — passenger + driver notification
// ─────────────────────────────────────────────────────────
async function sendRideCancelledEmail(ride, cancelledBy) {
  const passenger = ride.passenger || {};
  const driver    = ride.driver    || {};
  const by        = cancelledBy === 'driver' ? 'the driver' : 'the passenger';

  // Email to passenger
  if (passenger.email) {
    try {
      const subject = `RidePK — Ride Cancelled`;
      const html = wrap(subject, `
        ${h1('❌ Ride Cancelled')}
        ${p(`Hi <strong>${passenger.name || 'Passenger'}</strong>, your ride has been cancelled by ${by}.`)}
        ${rideTable(ride)}
        ${p('You can book a new ride anytime.')}
        ${btn(LOGIN_URL, '🔄 Book Again')}
      `);
      await sendBrevoEmail({ to: passenger.email, toName: passenger.name, subject, html,
        text: `Hi ${passenger.name}, your ride from ${ride.pickup} to ${ride.destination} was cancelled by ${by}.` });
      console.log('✅ Ride cancelled email sent to passenger:', passenger.email);
    } catch (err) {
      console.error('❌ Ride cancelled email (passenger) error:', err.message);
    }
  }

  // Email to driver (if they exist and cancellation was by passenger)
  if (driver.email && cancelledBy !== 'driver') {
    try {
      const subject = `RidePK — Ride Cancelled by Passenger`;
      const html = wrap(subject, `
        ${h1('❌ Ride Cancelled by Passenger')}
        ${p(`Hi <strong>${driver.fullName || 'Driver'}</strong>, the passenger has cancelled the ride.`)}
        ${rideTable(ride)}
        ${p('You can continue accepting new ride requests from your dashboard.')}
        ${btn(DRIVER_URL, '🚗 Dashboard')}
      `);
      await sendBrevoEmail({ to: driver.email, toName: driver.fullName, subject, html,
        text: `Hi ${driver.fullName}, the ride from ${ride.pickup} to ${ride.destination} was cancelled by the passenger.` });
      console.log('✅ Ride cancelled email sent to driver:', driver.email);
    } catch (err) {
      console.error('❌ Ride cancelled email (driver) error:', err.message);
    }
  }
}

module.exports = {
  sendRideAcceptedEmail,
  sendRideCompletedEmail,
  sendRideCancelledEmail
};