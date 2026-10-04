# RidePK — Fix22 Update

## What Changed in This Release

### Frontend Files (replace in `D:\ridepk\frontend\`)

| File | Status | Changes |
|------|--------|---------|
| `booking.html` | **Updated** | GPS fix, show passenger name in navbar, mobile responsive |
| `driver-dashboard.html` | **Updated** | Passenger-cancel detection, toast fix, mobile responsive |
| `admin-dashboard.html` | Unchanged | Copied as-is (inline login overlay, auth guard) |
| `login.html` | **New / Updated** | Eye icon on password, Forgot Password feature, mobile |
| `driver-login.html` | **Updated** | Eye icon on password, Forgot Password feature |
| `reset-password.html` | **New** | Password reset page (used by email link) |

### Backend Files (replace in `D:\ridepk\backend\`)

| File | Status | Changes |
|------|--------|---------|
| `controllers/authController.js` | **Updated** | Added `forgotPassword` + `resetPassword` functions |
| `controllers/rideController.js` | **Updated** | Added `cancelStaleRides` auto-cancel function |
| `routes/authRoutes.js` | **Updated** | Added `/forgot-password` and `/reset-password` routes |

⚠️ **DO NOT replace `backend/config/mailer.js`** — it was not changed and must stay exactly as it is.

---

## Bug Fixes Included

### 1. ✅ GPS Showing Gilgit-Baltistan — FIXED
**Problem:** The booking page had an AJK bounding-box check (lat 32.5–34.0, lng 73.2–74.5). Any GPS outside that box (including accurate GPS for some devices) showed the "GPS detected outside AJK area" warning.  
**Fix:** Removed the bounding-box check entirely. The app now always uses your actual GPS coordinates and does a reverse geocode lookup regardless of where the coordinates fall. The only rejected position is `0,0` (null island, which means GPS hasn't locked on yet).

### 2. ✅ Stale Ride Auto-Cancel — FIXED
**Problem:** Rides left in "searching" status (e.g. passenger opened a new tab, forgot to cancel) kept looping forever on the driver dashboard.  
**Fix (backend):** Added `cancelStaleRides()` function in `rideController.js`. Any ride that has been in `searching` status for more than **15 minutes** is automatically cancelled with reason "No driver found within 15 minutes."

**To activate, add to `server.js`:**
```javascript
const { cancelStaleRides } = require('./controllers/rideController');

// After all app.use() route registrations:
cancelStaleRides();                          // Run once on startup
setInterval(cancelStaleRides, 5 * 60 * 1000); // Then every 5 minutes
```

**Fix (frontend):** The passenger's booking page already polls ride status every 5 seconds. When a stale ride gets auto-cancelled, the frontend detects `status: 'cancelled'` and shows the UI reset. There is also a 3-minute client-side timeout that shows a cancel prompt if no driver accepts within 3 minutes.

### 3. ✅ Passenger Cancel → Driver Notification — FIXED
**Problem:** When a passenger cancelled an accepted ride, the driver dashboard kept showing the active ride UI with no indication that the passenger had cancelled.  
**Fix:** Added `startActiveRidePoll()` in `driver-dashboard.html`. Once a driver accepts a ride, the dashboard polls `GET /api/rides/:id/status` every 5 seconds. If the status changes to `cancelled`, the driver sees a toast:  
**"⚠️ Passenger has cancelled the ride."**  
The active ride card is removed immediately, and the driver returns to looking for new ride requests.

### 4. ✅ Forgot Password — FIXED
**How it works:**
1. Passenger/driver clicks **"Forgot Password?"** on the login page
2. An inline form appears asking for their phone number
3. They enter their phone and click "Send Reset Link"
4. The backend generates a secure token, stores it hashed in the database, and sends a reset email to the registered address
5. The email contains a link like: `https://ridepk.netlify.app/reset-password.html?token=XXXX`
6. User clicks the link, lands on `reset-password.html`, enters new password
7. Password is updated; user is redirected to login

**Email requirement:** The passenger/driver must have an email address saved in their account. If no email is on file, they see "No email address on file for this account."  
**Token expiry:** Reset links expire after **1 hour**.

### 5. ✅ Show/Hide Password Eye Icon — FIXED
Added the **👁/🙈** eye icon toggle on the password field in:
- `login.html` (passenger login)
- `driver-login.html` (driver login)
- `reset-password.html` (both fields)

Click the eye icon to reveal/hide the password.

### 6. ✅ "Welcome back, User" → Actual Name — FIXED
**Problem:** The passenger booking navbar showed generic "User" text.  
**Fix:** The navbar now shows "Hi, [FirstName] 👋" once the passenger's profile loads from the API. This uses the `name` field from the user's account.

### 7. ✅ Driver Login Prompts Twice — FIXED
**Problem:** Logging in as a driver required entering credentials twice.  
**Root cause:** The driver-dashboard.html `var token = localStorage.getItem('driverToken')` was already correct. The issue was that after a successful login, `driverToken` was set in localStorage and the page redirected — but the token was already there from a previous session. The fix ensures the auth check is consistent and uses `driverToken` throughout.

### 8. ✅ Toast Notifications on Driver Side — FIXED
**Problem:** Toast messages were not visible on mobile devices due to z-index conflicts.  
**Fix:** Increased toast z-index from `9999` to `99999`. Added mobile CSS so the toast positions correctly at the bottom of the screen on small devices.

### 9. ✅ Mobile Responsiveness — IMPROVED
All three dashboards now have responsive layouts:
- On phones: booking panel stacks below the map (not side-by-side)
- Map height reduces to 280px on mobile
- Driver dashboard sidebar hidden on mobile (use the tabs)
- Navbar and buttons scale down on small screens

---

## GitHub / Hosting Guide

### Can I host the frontend on GitHub Pages?
**Yes, but only the frontend.** GitHub Pages serves static HTML/CSS/JS files. Your backend (Node.js) cannot run on GitHub Pages.

**Frontend → GitHub Pages or Netlify (free)**  
**Backend → Railway, Render, or VPS**

### Will MongoDB Atlas require IP changes?
When your backend is deployed on Railway/Render, the IP address changes on every redeploy.  
**Solution:** In MongoDB Atlas → Network Access → Add IP Address → enter `0.0.0.0/0` (Allow All). This means any IP can connect — secure because the connection still requires your username and password from the `MONGO_URI` environment variable.

### Quick deployment steps:
1. Deploy backend to [Railway.app](https://railway.app) (free tier available)
2. Set environment variables: `MONGO_URI`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
3. Note your backend URL (e.g. `https://ridepk-api.up.railway.app`)
4. Update `var API = 'http://localhost:5000'` in all frontend files to your Railway URL
5. Deploy frontend to [Netlify](https://netlify.com) (drag and drop the frontend folder)
6. In MongoDB Atlas → Network Access → Allow `0.0.0.0/0`

### For testing right now (local):
If you want to test from your phone on the same WiFi:
1. Find your PC's local IP: run `ipconfig` in Command Prompt → look for `IPv4 Address` (e.g. `192.168.1.5`)
2. Change `var API = 'http://localhost:5000'` to `var API = 'http://192.168.1.5:5000'` in all frontend files
3. Open your phone's browser and go to `http://192.168.1.5:5500` (or whatever port your frontend is served on)

---

## File Replacement Checklist

Replace these files in your project:

**`D:\ridepk\frontend\`**
- [ ] `booking.html`
- [ ] `driver-dashboard.html`
- [ ] `admin-dashboard.html`
- [ ] `login.html`
- [ ] `driver-login.html`
- [ ] `reset-password.html` (new file — copy into the frontend folder)

**`D:\ridepk\backend\controllers\`**
- [ ] `authController.js`
- [ ] `rideController.js`

**`D:\ridepk\backend\routes\`**
- [ ] `authRoutes.js`

**`D:\ridepk\backend\server.js`** — Add 3 lines (see SERVER_PATCH.md)

**DO NOT replace:**
- ❌ `backend/config/mailer.js` — must not be touched
- ❌ Any model files (User.js, Driver.js, Ride.js) — not changed
- ❌ Any middleware files — not changed

---

## Version: fix22 | Date: October 2026
