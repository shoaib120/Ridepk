// =====================================================
//  backend/config/mailer.js
//  All transactional emails for RidePK
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

// Trim trailing slash so links never have double slashes
const BASE = (process.env.FRONTEND_URL || 'https://ridepk-frontend.vercel.app').replace(/\/$/, '');
const LOGIN_URL        = BASE + '/frontend/login.html';
const DRIVER_LOGIN_URL = BASE + '/frontend/driver-login.html';
const ADMIN_URL        = BASE + '/frontend/admin-login.html';
const ADMIN_EMAIL      = process.env.ADMIN_EMAIL || '';

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
        <!-- Header -->
        <tr><td style="background:${DARK};padding:22px 30px">
          <span style="font-size:1.3rem;font-weight:800;color:#fff;letter-spacing:-0.5px">🚗 Ride<span style="color:${ORANGE}">PK</span></span>
          <span style="display:block;color:#a0a0b8;font-size:0.78rem;margin-top:2px">Mirpur AJK — Pakistan</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 30px 10px">
          ${body}
        </td></tr>
        <!-- Footer -->
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

// ─────────────────────────────────────────────────────────
//  1. DRIVER WELCOME EMAIL  (sent on driver registration)
// ─────────────────────────────────────────────────────────
async function sendDriverWelcomeEmail(driver) {
  if (!driver.email) return; // skip if no email
  try {
    const transporter = getTransporter();
    const subject = `RidePK — Application Received, ${driver.fullName}`;
    const html = wrap(subject, `
      ${h1('✅ Application Received!')}
      ${p(`Hi <strong>${driver.fullName}</strong>, thank you for registering with RidePK.`)}
      ${p('Your driver application has been submitted and is now under review. Our team will verify your documents and respond within <strong>24–48 hours</strong>.')}
      <table style="background:#f8f8fc;border-radius:8px;padding:14px 18px;margin:12px 0 18px;width:100%;border-collapse:collapse">
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">📞 Phone</td><td style="font-weight:600;font-size:0.85rem">${driver.phone}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">🏙️ City</td><td style="font-weight:600;font-size:0.85rem">${driver.city}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">🚗 Vehicle</td><td style="font-weight:600;font-size:0.85rem">${driver.vehicle && driver.vehicle.make ? driver.vehicle.make + ' ' + driver.vehicle.model : 'N/A'}</td></tr>
      </table>
      ${p('Once approved, you will receive another email with login instructions. Keep an eye on your inbox (and spam folder).')}
      ${p('If you have questions, contact us via WhatsApp.')}
    `);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to:      driver.email,
      subject,
      html,
      text: `Hi ${driver.fullName}, your RidePK driver application has been received. We will review it within 24-48 hours and contact you.`
    });
    console.log('✅ Driver welcome email sent to', driver.email);
  } catch (err) {
    console.error('❌ Driver welcome email error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  2. ADMIN — NEW DRIVER NOTIFICATION
// ─────────────────────────────────────────────────────────
async function sendAdminDriverNotification(driver) {
  if (!ADMIN_EMAIL) return;
  try {
    const transporter = getTransporter();
    const subject = `New Driver Application — ${driver.fullName}`;
    const html = wrap(subject, `
      ${h1('🚗 New Driver Application')}
      ${p(`A new driver has registered on RidePK and is waiting for approval.`)}
      <table style="background:#f8f8fc;border-radius:8px;padding:14px 18px;margin:12px 0 18px;width:100%;border-collapse:collapse">
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Name</td><td style="font-weight:600;font-size:0.85rem">${driver.fullName}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Phone</td><td style="font-weight:600;font-size:0.85rem">${driver.phone}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">CNIC</td><td style="font-weight:600;font-size:0.85rem">${driver.cnic}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">City</td><td style="font-weight:600;font-size:0.85rem">${driver.city}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Vehicle</td><td style="font-weight:600;font-size:0.85rem">${driver.vehicle && driver.vehicle.make ? driver.vehicle.make + ' ' + driver.vehicle.model + ' (' + driver.vehicle.plate + ')' : 'N/A'}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Service</td><td style="font-weight:600;font-size:0.85rem">${driver.serviceType}</td></tr>
      </table>
      ${btn(ADMIN_URL, '🔐 Open Admin Panel')}
    `);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      to:      ADMIN_EMAIL,
      subject,
      html,
      text: `New driver application from ${driver.fullName} (${driver.phone}). Login to admin panel to review.`
    });
    console.log('✅ Admin driver notification sent');
  } catch (err) {
    console.error('❌ Admin driver notification error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  3. DRIVER APPROVAL EMAIL  (sent to driver when approved)
// ─────────────────────────────────────────────────────────
async function sendDriverApprovalEmail(driver) {
  if (!driver.email) {
    console.log('⚠️  Driver has no email — skipping approval email');
    return;
  }
  try {
    const transporter = getTransporter();
    const subject = `RidePK — Your account has been approved, ${driver.fullName}!`;
    const html = wrap(subject, `
      ${h1('🎉 Your Account is Approved!')}
      ${p(`Congratulations <strong>${driver.fullName}</strong>! Your RidePK driver account has been reviewed and <strong style="color:#22c55e">approved</strong>.`)}
      ${p('You can now log in to your driver dashboard and start accepting rides.')}
      <div style="background:#f0fff4;border:1px solid #22c55e44;border-radius:8px;padding:14px 18px;margin:12px 0 18px">
        <p style="margin:0;color:#166534;font-size:0.88rem;font-weight:600">📌 Next Steps:</p>
        <ol style="margin:8px 0 0;padding-left:20px;color:#444;font-size:0.85rem;line-height:1.8">
          <li>Log in using your registered phone number and password</li>
          <li>Subscribe to a plan (Monthly or Yearly)</li>
          <li>Submit payment proof</li>
          <li>Once subscription is approved, go online and start earning!</li>
        </ol>
      </div>
      ${btn(DRIVER_LOGIN_URL, '🚗 Login to Driver Dashboard')}
      ${p('<small>If the button does not work, copy this link: ' + DRIVER_LOGIN_URL + '</small>')}
    `);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to:      driver.email,
      subject,
      html,
      text: `Hi ${driver.fullName}, your RidePK driver account has been approved! Login at: ${DRIVER_LOGIN_URL}`
    });
    console.log('✅ Driver approval email sent to', driver.email);
  } catch (err) {
    console.error('❌ Driver approval email error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  4. ADMIN — DRIVER APPROVED CONFIRMATION
//     (sent to admin after they approve a driver)
// ─────────────────────────────────────────────────────────
async function sendAdminDriverApprovedNotification(driver) {
  if (!ADMIN_EMAIL) return;
  try {
    const transporter = getTransporter();
    const subject = `Driver Approved — ${driver.fullName}`;
    const html = wrap(subject, `
      ${h1('✅ Driver Approved')}
      ${p(`You have approved the following driver on RidePK. An approval email has been sent to the driver.`)}
      <table style="background:#f0fff4;border:1px solid #22c55e44;border-radius:8px;padding:14px 18px;margin:12px 0 18px;width:100%;border-collapse:collapse">
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Name</td><td style="font-weight:600;font-size:0.85rem">${driver.fullName}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Phone</td><td style="font-weight:600;font-size:0.85rem">${driver.phone}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">CNIC</td><td style="font-weight:600;font-size:0.85rem">${driver.cnic}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">City</td><td style="font-weight:600;font-size:0.85rem">${driver.city}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Vehicle</td><td style="font-weight:600;font-size:0.85rem">${driver.vehicle && driver.vehicle.make ? driver.vehicle.make + ' ' + driver.vehicle.model + ' (' + driver.vehicle.plate + ')' : 'N/A'}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Service</td><td style="font-weight:600;font-size:0.85rem">${driver.serviceType}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Status</td><td style="font-weight:700;font-size:0.85rem;color:#22c55e">APPROVED ✅</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Approved At</td><td style="font-weight:600;font-size:0.85rem">${new Date().toLocaleString('en-PK')}</td></tr>
      </table>
      ${p('The driver has been notified by email and can now log in.')}
      ${btn(ADMIN_URL, '🔐 Open Admin Panel')}
    `);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      to:      ADMIN_EMAIL,
      subject,
      html,
      text: `You approved driver ${driver.fullName} (${driver.phone}). They have been notified by email.`
    });
    console.log('✅ Admin driver approved notification sent');
  } catch (err) {
    console.error('❌ Admin driver approved notification error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  5. DRIVER REJECTION EMAIL
// ─────────────────────────────────────────────────────────
async function sendDriverRejectionEmail(driver, reason) {
  if (!driver.email) return;
  try {
    const transporter = getTransporter();
    const subject = `RidePK — Application Update for ${driver.fullName}`;
    const html = wrap(subject, `
      ${h1('Application Status Update')}
      ${p(`Hi <strong>${driver.fullName}</strong>, we have reviewed your RidePK driver application.`)}
      ${p('Unfortunately, we were unable to approve your application at this time.')}
      <div style="background:#fff5f5;border:1px solid #ef444444;border-radius:8px;padding:14px 18px;margin:12px 0 18px">
        <p style="margin:0;color:#991b1b;font-size:0.85rem;font-weight:600">Reason:</p>
        <p style="margin:6px 0 0;color:#444;font-size:0.85rem">${reason || 'Documents not clear or incomplete.'}</p>
      </div>
      ${p('You may re-apply after addressing the issue. If you have questions, contact us via WhatsApp.')}
    `);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to:      driver.email,
      subject,
      html,
      text: `Hi ${driver.fullName}, your application was not approved. Reason: ${reason || 'Documents not clear.'}`
    });
    console.log('✅ Driver rejection email sent to', driver.email);
  } catch (err) {
    console.error('❌ Driver rejection email error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  6. PASSENGER WELCOME EMAIL
// ─────────────────────────────────────────────────────────
async function sendPassengerWelcomeEmail(user) {
  if (!user.email) return;
  try {
    const transporter = getTransporter();
    const subject = `RidePK — Welcome, ${user.name}!`;
    const html = wrap(subject, `
      ${h1('Welcome to RidePK! 🎉')}
      ${p(`Hi <strong>${user.name}</strong>, your passenger account has been created successfully.`)}
      ${p('You can now book rides across Mirpur AJK and nearby cities.')}
      ${btn(LOGIN_URL, '🚗 Book Your First Ride')}
      ${p('<small>If the button does not work, copy this link: ' + LOGIN_URL + '</small>')}
    `);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to:      user.email,
      subject,
      html,
      text: `Hi ${user.name}, welcome to RidePK! Book rides at: ${LOGIN_URL}`
    });
    console.log('✅ Passenger welcome email sent to', user.email);
  } catch (err) {
    console.error('❌ Passenger welcome email error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  7. ADMIN — NEW PASSENGER NOTIFICATION
// ─────────────────────────────────────────────────────────
async function sendAdminPassengerNotification(user) {
  if (!ADMIN_EMAIL) return;
  try {
    const transporter = getTransporter();
    const subject = `New Passenger Registered — ${user.name}`;
    const html = wrap(subject, `
      ${h1('👤 New Passenger Registration')}
      ${p('A new passenger has registered on RidePK.')}
      <table style="background:#f8f8fc;border-radius:8px;padding:14px 18px;margin:12px 0;width:100%;border-collapse:collapse">
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Name</td><td style="font-weight:600;font-size:0.85rem">${user.name}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Phone</td><td style="font-weight:600;font-size:0.85rem">${user.phone}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Email</td><td style="font-weight:600;font-size:0.85rem">${user.email || 'N/A'}</td></tr>
      </table>
      ${btn(ADMIN_URL, '🔐 Open Admin Panel')}
    `);
    await transporter.sendMail({
      from: `"RidePK" <${process.env.EMAIL_USER}>`,
      to:   ADMIN_EMAIL,
      subject,
      html,
      text: `New passenger: ${user.name} (${user.phone})`
    });
    console.log('✅ Admin passenger notification sent');
  } catch (err) {
    console.error('❌ Admin passenger notification error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  8. DRIVER SUBSCRIPTION RECEIVED (sent to driver)
// ─────────────────────────────────────────────────────────
async function sendDriverSubscriptionReceived(driver) {
  if (!driver.email) return;
  try {
    const transporter = getTransporter();
    const sub = driver.subscription || {};
    const subject = `RidePK — Subscription Payment Received`;
    const html = wrap(subject, `
      ${h1('💳 Payment Proof Received')}
      ${p(`Hi <strong>${driver.fullName}</strong>, we have received your subscription payment proof.`)}
      <table style="background:#f8f8fc;border-radius:8px;padding:14px 18px;margin:12px 0 18px;width:100%;border-collapse:collapse">
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Plan</td><td style="font-weight:600;font-size:0.85rem">${sub.plan || 'Monthly'}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Amount</td><td style="font-weight:600;font-size:0.85rem">Rs. ${sub.amount || '—'}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Method</td><td style="font-weight:600;font-size:0.85rem">${sub.paymentMethod || '—'}</td></tr>
      </table>
      ${p('Our team will review the payment and approve your subscription within <strong>a few hours</strong>.')}
      ${p('<strong>Important:</strong> You will need to log in again after the review is complete to see your updated subscription status.')}
      ${btn(DRIVER_LOGIN_URL, '🔐 Driver Login')}
    `);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to:      driver.email,
      subject,
      html,
      text: `Hi ${driver.fullName}, your subscription payment proof has been received. We will review it shortly. Please log in again after approval: ${DRIVER_LOGIN_URL}`
    });
    console.log('✅ Driver subscription received email sent to', driver.email);
  } catch (err) {
    console.error('❌ Driver subscription received email error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  9. ADMIN — NEW SUBSCRIPTION NOTIFICATION
// ─────────────────────────────────────────────────────────
async function sendAdminSubscriptionNotification(driver) {
  if (!ADMIN_EMAIL) return;
  try {
    const transporter = getTransporter();
    const sub = driver.subscription || {};
    const subject = `Subscription Proof Submitted — ${driver.fullName}`;
    const html = wrap(subject, `
      ${h1('💳 New Subscription Payment')}
      ${p(`Driver <strong>${driver.fullName}</strong> has submitted subscription payment proof and is waiting for approval.`)}
      <table style="background:#f8f8fc;border-radius:8px;padding:14px 18px;margin:12px 0 18px;width:100%;border-collapse:collapse">
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Driver</td><td style="font-weight:600;font-size:0.85rem">${driver.fullName}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Phone</td><td style="font-weight:600;font-size:0.85rem">${driver.phone}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Plan</td><td style="font-weight:600;font-size:0.85rem">${sub.plan || 'Monthly'}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Amount</td><td style="font-weight:600;font-size:0.85rem">Rs. ${sub.amount || '—'}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Method</td><td style="font-weight:600;font-size:0.85rem">${sub.paymentMethod || '—'}</td></tr>
      </table>
      ${btn(ADMIN_URL, '🔐 Review in Admin Panel')}
    `);
    await transporter.sendMail({
      from: `"RidePK" <${process.env.EMAIL_USER}>`,
      to:   ADMIN_EMAIL,
      subject,
      html,
      text: `${driver.fullName} submitted a ${sub.plan} subscription payment of Rs. ${sub.amount} via ${sub.paymentMethod}. Review at admin panel.`
    });
    console.log('✅ Admin subscription notification sent');
  } catch (err) {
    console.error('❌ Admin subscription notification error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
//  10. DRIVER SUBSCRIPTION RESULT (approve / reject)
// ─────────────────────────────────────────────────────────
async function sendDriverSubscriptionResult(driver, approved) {
  if (!driver.email) {
    console.log('⚠️  Driver has no email — skipping subscription result email');
    return;
  }
  try {
    const transporter = getTransporter();
    const sub = driver.subscription || {};
    const subject = approved
      ? `RidePK — Subscription Approved!`
      : `RidePK — Subscription Payment Update`;

    const body = approved ? `
      ${h1('🎉 Subscription Approved!')}
      ${p(`Hi <strong>${driver.fullName}</strong>, your RidePK subscription has been <strong style="color:#22c55e">approved</strong>!`)}
      <table style="background:#f0fff4;border:1px solid #22c55e44;border-radius:8px;padding:14px 18px;margin:12px 0 18px;width:100%;border-collapse:collapse">
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Plan</td><td style="font-weight:600;font-size:0.85rem">${sub.plan || 'Monthly'}</td></tr>
        <tr><td style="color:#666;font-size:0.82rem;padding:3px 0">Valid Until</td><td style="font-weight:600;font-size:0.85rem">${sub.endDate ? new Date(sub.endDate).toLocaleDateString('en-PK', {day:'2-digit',month:'long',year:'numeric'}) : 'N/A'}</td></tr>
      </table>
      ${p('You can now log in and start accepting ride requests.')}
      ${btn(DRIVER_LOGIN_URL, '🚗 Login & Start Driving')}
      ${p('<small>Note: Please log out and log in again to refresh your account status.</small>')}
    ` : `
      ${h1('Subscription Payment Update')}
      ${p(`Hi <strong>${driver.fullName}</strong>, we were unable to verify your subscription payment.`)}
      ${p('Please submit your payment again with a clear screenshot. Make sure the amount and transaction details are visible.')}
      ${btn(DRIVER_LOGIN_URL, '🔄 Resubmit Payment')}
    `;

    const html = wrap(subject, body);
    await transporter.sendMail({
      from:    `"RidePK" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to:      driver.email,
      subject,
      html,
      text: approved
        ? `Hi ${driver.fullName}, your subscription is approved. Login at: ${DRIVER_LOGIN_URL}`
        : `Hi ${driver.fullName}, your subscription payment could not be verified. Please resubmit at: ${DRIVER_LOGIN_URL}`
    });
    console.log('✅ Driver subscription result email sent to', driver.email);
  } catch (err) {
    console.error('❌ Driver subscription result email error:', err.message);
  }
}

module.exports = {
  sendDriverWelcomeEmail,
  sendAdminDriverNotification,
  sendDriverApprovalEmail,
  sendAdminDriverApprovedNotification,
  sendDriverRejectionEmail,
  sendPassengerWelcomeEmail,
  sendAdminPassengerNotification,
  sendDriverSubscriptionReceived,
  sendAdminSubscriptionNotification,
  sendDriverSubscriptionResult
};