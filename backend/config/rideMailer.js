// =====================================================
//  backend/config/rideMailer.js
//  Ride-event transactional emails for RidePK
//  (registration / subscription emails are in mailer.js)
// =====================================================

const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

const BASE = (process.env.FRONTEND_URL || 'https://ridepk-frontend.vercel.app').replace(/\/$/, '');
const LOGIN_URL        = BASE + '/frontend/login.html';
const DRIVER_LOGIN_URL = BASE + '/frontend/driver-login.html';

const ORANGE = '#ff6b00';
const DARK   = '#1a1a2e';

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
function h1(text) { return `<h2 style="margin:0 0 10px;color:#1a1a2e;font-size:1.15rem">${text}</h2>`; }
function p(text)  { return `<p  style="margin:0 0 12px;color:#444;font-size:0.9rem;line-height:1.6">${text}</p>`; }
function row(label, value) {
  return `<tr><td style="color:#666;font-size:0.82rem;padding:3px 0">${label}</td><td style="font-weight:600;font-size:0.85rem">${value}</td></tr>`;
}
function table(rows) {
  return `<table style="background:#f8f8fc;border-radius:8px;padding:14px 18px;margin:12px 0 18px;width:100%;border-collapse:collapse">${rows}</table>`;
}

// ─────────────────────────────────────────────────────────
//  1. RIDE ACCEPTED — email to passenger
// ─────────────────────────────────────────────────────────
async function sendRideAcceptedEmail(passenger, driver, ride) {
  if (!passenger || !passenger.email) return;
  try {
    const transporter = getTransporter();
    const fare = ride.finalPrice || ride.counterOffer || ride.offeredPrice || 0;
    const vehicle = driver.vehicle
      ? `${driver.vehicle.make || ''} ${driver.vehicle.model || ''} (${driver.vehicle.plate || 'N/A'})`.trim()
      : 'N/A';
    const subject = `RidePK — Your ride has been accepted!`;
    const html = wrap(subject, `
      ${h1('🚗 Driver On the Way!')}
      ${p(`Hi <strong>${passenger.name}</strong>, your ride request has been accepted. Your driver is heading to your pickup location.`)}
      ${table(
        row('Driver',      driver.fullName || 'N/A') +
        row('Phone',       driver.phone    || 'N/A') +
        row('Vehicle',     vehicle) +
        row('Pickup',      ride.pickup    && (ride.pickup.address    || '') || 'N/A') +
        row('Destination', ride.destination && (ride.destination.address || '') || 'N/A') +
        row('Agreed Fare', `Rs. ${fare}`)
      )}
      ${p('Please be ready at your pickup location. You can track the driver on the RidePK app.')}
      ${btn(LOGIN_URL, '📍 Open RidePK App')}
    `);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to:      passenger.email,
      subject,
      html,
      text: `Hi ${passenger.name}, your ride has been accepted by ${driver.fullName} (${driver.phone}). Vehicle: ${vehicle}. Agreed fare: Rs. ${fare}.`
    });
    console.log('✅ Ride accepted email sent to passenger:', passenger.email);
  } catch (err) {
    console.error('❌ Ride accepted email error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  2. RIDE COMPLETED — email to passenger
// ─────────────────────────────────────────────────────────
async function sendRideCompletedEmail(passenger, driver, ride) {
  if (!passenger || !passenger.email) return;
  try {
    const transporter = getTransporter();
    const fare = ride.finalPrice || ride.offeredPrice || 0;
    const subject = `RidePK — Ride Completed. Thanks for riding!`;
    const completedAt = ride.completedAt
      ? new Date(ride.completedAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
      : 'N/A';
    const html = wrap(subject, `
      ${h1('✅ Ride Completed!')}
      ${p(`Hi <strong>${passenger.name}</strong>, your ride has been completed. Thank you for using RidePK!`)}
      ${table(
        row('Driver',      driver.fullName || 'N/A') +
        row('From',        ride.pickup    && (ride.pickup.address    || '') || 'N/A') +
        row('To',          ride.destination && (ride.destination.address || '') || 'N/A') +
        row('Distance',    ride.distanceKm ? `${ride.distanceKm} km` : 'N/A') +
        row('Fare Paid',   `<strong style="color:#22c55e">Rs. ${fare}</strong>`) +
        row('Payment',     ride.paymentMethod || 'Cash') +
        row('Completed',   completedAt)
      )}
      ${p('We hope you had a great ride. Please rate your experience in the app.')}
      ${btn(LOGIN_URL, '⭐ Rate Your Ride')}
    `);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to:      passenger.email,
      subject,
      html,
      text: `Hi ${passenger.name}, your ride with ${driver.fullName} has been completed. Fare: Rs. ${fare}. Thank you for using RidePK!`
    });
    console.log('✅ Ride completed email sent to passenger:', passenger.email);
  } catch (err) {
    console.error('❌ Ride completed email error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  3. RIDE CANCELLED — email to the OTHER party
//     cancelledBy = 'passenger' → email the driver
//     cancelledBy = 'driver'    → email the passenger
// ─────────────────────────────────────────────────────────
async function sendRideCancelledEmail(passenger, driver, ride, cancelledBy, cancelReason) {
  try {
    const transporter = getTransporter();
    const reason = cancelReason || 'No reason provided';

    // Email the driver if passenger cancelled (and driver is assigned)
    if (cancelledBy === 'passenger' && driver && driver.email) {
      const subject = `RidePK — Ride Cancelled by Passenger`;
      const html = wrap(subject, `
        ${h1('❌ Ride Cancelled')}
        ${p(`Hi <strong>${driver.fullName}</strong>, the passenger has cancelled this ride.`)}
        ${table(
          row('Passenger',   passenger ? (passenger.name || 'N/A') : 'N/A') +
          row('Pickup',      ride.pickup && (ride.pickup.address || '') || 'N/A') +
          row('Reason',      reason)
        )}
        ${p('You are now free to accept new ride requests.')}
        ${btn(DRIVER_LOGIN_URL, '🚗 Back to Dashboard')}
      `);
      await transporter.sendMail({
        from:    `"RidePK" <${process.env.EMAIL_USER}>`,
        replyTo: process.env.EMAIL_USER,
        to:      driver.email,
        subject,
        html,
        text: `Hi ${driver.fullName}, the passenger cancelled the ride. Reason: ${reason}.`
      });
      console.log('✅ Ride cancelled email sent to driver:', driver.email);
    }

    // Email the passenger if driver cancelled (or system cancelled)
    if (cancelledBy !== 'passenger' && passenger && passenger.email) {
      const subject = `RidePK — Your Ride Was Cancelled`;
      const html = wrap(subject, `
        ${h1('❌ Your Ride Was Cancelled')}
        ${p(`Hi <strong>${passenger.name}</strong>, unfortunately your ride has been cancelled.`)}
        ${table(
          row('Cancelled by', cancelledBy === 'driver' ? 'Driver' : 'System') +
          row('Pickup',       ride.pickup && (ride.pickup.address || '') || 'N/A') +
          row('Reason',       reason)
        )}
        ${p('We apologise for the inconvenience. Please book a new ride — another driver will be with you shortly.')}
        ${btn(LOGIN_URL, '🔄 Book a New Ride')}
      `);
      await transporter.sendMail({
        from:    `"RidePK" <${process.env.EMAIL_USER}>`,
        replyTo: process.env.EMAIL_USER,
        to:      passenger.email,
        subject,
        html,
        text: `Hi ${passenger.name}, your ride was cancelled by ${cancelledBy === 'driver' ? 'the driver' : 'the system'}. Reason: ${reason}. Please book a new ride.`
      });
      console.log('✅ Ride cancelled email sent to passenger:', passenger.email);
    }
  } catch (err) {
    console.error('❌ Ride cancelled email error:', err.message);
  }
}

module.exports = {
  sendRideAcceptedEmail,
  sendRideCompletedEmail,
  sendRideCancelledEmail
};
