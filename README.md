# 🚗 RidePK — Complete Setup, Testing & Run Guide
## Version 3.0 — Mirpur AJK Ride Platform

---

## WHAT IS FIXED / NEW IN THIS VERSION

| # | Issue | Fix |
|---|-------|-----|
| 1 | Map showed straight line, not real roads | Now uses OSRM (free routing engine) — shows real road path, real distance, real travel time |
| 2 | Ride requests not passing to next driver | Auto-passes to next available driver every 8 seconds. All online drivers shown on map |
| 3 | Driver can submit form without uploading photos | ALL 6 documents now required. Clear error message shows which ones are missing |
| 4 | Admin cannot see driver photos | Driver detail modal now shows all 6 uploaded photos. Click any photo to see full size |
| 5 | No passenger approval system | Admin can toggle: require approval before passenger can login, OR allow direct access |
| 6 | No email notifications | Admin receives Gmail email when driver registers, passenger registers, or subscription proof is submitted |
| 7 | No notification when admin approves request | Driver/passenger receives email when their account is approved |

---

## FOLDER STRUCTURE

```
ridepk-project/               ← Your main project folder
│
├── README.md                 ← THIS FILE
│
├── frontend/                 ← All HTML, CSS, JS files
│   ├── index.html            ← Homepage
│   ├── booking.html          ← Book a ride (real road map)
│   ├── driver-register.html  ← Driver signup (all documents required)
│   ├── driver-dashboard.html ← Driver: go online, accept rides, subscription
│   ├── passenger-dashboard.html ← Passenger: history, active ride
│   ├── admin-login.html      ← Admin login
│   ├── admin-dashboard.html  ← Admin panel (approve, freeze, view photos)
│   ├── login.html            ← Login for passenger or driver
│   ├── register.html         ← Passenger signup
│   ├── cities.html           ← Cities page
│   ├── css/
│   │   ├── style.css
│   │   ├── booking.css
│   │   ├── auth.css
│   │   ├── dashboard.css
│   │   ├── driver.css
│   │   └── admin.css
│   └── js/
│       ├── api.js            ← API helper (all pages use this)
│       ├── booking.js        ← Real road routing, auto-pass to drivers
│       ├── driver.js         ← Registration form with mandatory docs
│       └── socket-client.js  ← Real-time events
│
└── backend/                  ← Node.js server
    ├── server.js             ← Main server file
    ├── package.json          ← Dependencies list
    ├── .env                  ← YOUR CONFIG — edit this first
    ├── config/
    │   ├── db.js             ← MongoDB connection
    │   └── mailer.js         ← Email notification helper
    ├── models/
    │   ├── Admin.js          ← Admin with settings (approval mode, email)
    │   ├── User.js           ← Passenger with status (active/pending/frozen)
    │   ├── Driver.js         ← Driver with subscription, documents, location
    │   └── Ride.js           ← Ride with real pricing, cancel reason
    ├── controllers/
    │   ├── adminController.js    ← Full admin control + photo URLs
    │   ├── authController.js     ← Login/register + passenger approval check
    │   ├── driverController.js   ← Driver actions + email on register
    │   ├── rideController.js     ← Ride lifecycle + Rs.40/km pricing
    │   └── userController.js     ← Passenger profile
    ├── routes/
    │   ├── adminRoutes.js
    │   ├── authRoutes.js
    │   ├── driverRoutes.js
    │   ├── rideRoutes.js
    │   └── userRoutes.js
    ├── middleware/
    │   ├── auth.js           ← JWT check
    │   └── upload.js         ← File upload handler
    ├── socket/
    │   └── socket.js         ← Real-time GPS and ride events
    ├── uploads/              ← Driver documents saved here
    └── scripts/
        ├── seedDB.js         ← Creates test data (run once)
        └── testAPI.js        ← Tests all API endpoints
```

---

## STEP 1 — INSTALL REQUIRED SOFTWARE

Do this once only. Then you never need to do it again.

### A) Install VS Code
1. Go to https://code.visualstudio.com
2. Click Download for Windows
3. Run the installer, click Next → Next → Install
4. After install, open VS Code

### B) Install the Live Server extension in VS Code
1. In VS Code, click the Extensions icon on the left (4 squares)
2. In the search box type: Live Server
3. Click Install on the first result (by Ritwick Dey)
4. Wait for it to install

### C) Install Node.js
1. Go to https://nodejs.org
2. Click the LTS button (green)
3. Download the .msi file
4. Double-click it → click Next → Next → Install → Finish
5. Restart your computer after installing

### D) Verify Node.js installed correctly
1. Press Windows key + R on keyboard
2. Type: cmd
3. Press Enter (black window opens)
4. Type this and press Enter:
   ```
   node --version
   ```
5. You should see something like: v20.11.0
   If you see it = Node.js is installed correctly ✅
6. Also type:
   ```
   npm --version
   ```
7. You should see: 10.x.x ✅

---

## STEP 2 — SET UP MONGODB DATABASE (free)

### A) Create Atlas account
1. Open browser, go to: https://www.mongodb.com/atlas
2. Click "Try Free" (green button, top right)
3. Sign up with your email and create a password
4. Verify your email (check inbox)

### B) Create a free cluster
1. After login, you see "Create a cluster"
2. Choose: FREE / M0 Shared
3. Cloud Provider: AWS
4. Region: Singapore (closest to Pakistan)
5. Cluster Name: leave as "Cluster0"
6. Click "Create Cluster"
7. Wait 2–3 minutes for it to set up

### C) Create a database user
1. On left sidebar: click "Database Access"
2. Click "Add New Database User"
3. Authentication Method: Password
4. Username: ridepkuser
5. Password: ridepk123  (or any password you choose — REMEMBER IT)
6. Database User Privileges: "Atlas admin"
7. Click "Add User"

### D) Allow all IP addresses
1. On left sidebar: click "Network Access"
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere"
4. Click "Confirm"
   This allows your PC to connect. Important!

### E) Get your connection string
1. Go back to "Database" (left sidebar)
2. Click "Connect" button on your cluster
3. Choose "Drivers"
4. Driver: Node.js
5. Version: 5.5 or later
6. Copy the connection string. It looks like:
   ```
   mongodb+srv://ridepkuser:<password>@cluster0.abc123.mongodb.net/
   ```
7. Replace `<password>` with your actual password (ridepk123)
8. Add `ridepk` at the end before the `?`

Your final MONGO_URI should look like:
```
mongodb+srv://ridepkuser:ridepk123@cluster0.abc123.mongodb.net/ridepk
```

### F) Set it in your .env file
1. Open `backend/.env` in VS Code
2. Find the line: MONGO_URI=mongodb://localhost:27017/ridepk
3. Replace the whole line with yours:
   ```
   MONGO_URI=mongodb+srv://ridepkuser:ridepk123@cluster0.abc123.mongodb.net/ridepk
   ```
4. Save the file (Ctrl+S)

### MONGODB ATLAS: CAN I RUN MULTIPLE PROJECTS?
Yes! One free account gives you ONE free cluster (M0).
That cluster can hold UNLIMITED databases.
Each project just uses a different database name.
- Project 1: ...mongodb.net/ridepk
- Project 2: ...mongodb.net/myproject2
- Project 3: ...mongodb.net/anotherproject
The 512MB storage limit is per cluster total, shared across all databases.
For development, 512MB is more than enough for thousands of rides.

---

## STEP 3 — CONFIGURE YOUR .env FILE

Open `backend/.env` in VS Code and set these values:

```
# Your Atlas URL (from Step 2)
MONGO_URI=mongodb+srv://ridepkuser:ridepk123@cluster0.XXXXX.mongodb.net/ridepk

# Keep this as is (or change to any random string)
JWT_SECRET=ridepk_secret_key_change_this_xyz_2024_abc_def

# Server port — do not change
PORT=5000

# Admin login credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=RidePK@Admin2024
ADMIN_EMAIL=your_gmail@gmail.com

# Email notifications (Gmail) — optional but recommended
# Setup instructions below in STEP 7
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password

# Leave this
FRONTEND_URL=http://localhost:5500
```

Save the file after editing.

---

## STEP 4 — INSTALL BACKEND PACKAGES

1. Open VS Code
2. File → Open Folder → select your backend folder
3. Open Terminal in VS Code: go to top menu → Terminal → New Terminal
4. A terminal opens at the bottom of VS Code
5. You should see the path ends with `\backend>`
6. Type this command and press Enter:

```
npm install
```

You will see many lines scrolling. This downloads all required packages.
Wait until it stops (1–3 minutes depending on internet).

Expected output at the end:
```
added 156 packages, and audited 157 packages in 45s
found 0 vulnerabilities
```

A `node_modules` folder will appear in your backend folder. This is normal.

**If you get a DNS error like "ENOTFOUND" or "getaddrinfo":**
This is a network/DNS issue. Fix it:
1. Press Windows key → search "Network Settings" → open it
2. Go to your WiFi or ethernet → Properties
3. Click "Edit" next to DNS server
4. Set Primary DNS: 8.8.8.8 (Google)
5. Set Secondary DNS: 1.1.1.1 (Cloudflare)
6. Click Save
7. Try `npm install` again

---

## STEP 5 — START THE BACKEND SERVER

In the same VS Code terminal (inside backend folder), type:

```
npm run dev
```

Press Enter.

**Expected output — you MUST see both these lines:**
```
🚗 ================================
🚗  RidePK v2.0 — port 5000
🚗 ================================
✅ MongoDB Connected: cluster0.XXXXX.mongodb.net
```

**If you see "MongoDB Connected" = everything is working ✅**

**KEEP THIS TERMINAL OPEN. Do not close it while testing.**

**If you see MongoDB connection error:**
- Check your MONGO_URI in .env is correct
- Check Network Access in Atlas has 0.0.0.0/0 allowed
- Check your internet is working

---

## STEP 6 — FILL DATABASE WITH TEST DATA

Open a SECOND terminal in VS Code:
- Go to top menu → Terminal → New Terminal
- Make sure it shows the backend folder path

Type this command:
```
npm run seed
```

Or:
```
node scripts/seedDB.js
```

**Expected output:**
```
✅ Connected!
✅ Admin created
   Username: admin
   Password: RidePK@Admin2024
   Login at: http://127.0.0.1:5500/admin-login.html

✅ Passenger: 0300-1111111 / test123
✅ Passenger: 0300-2222222 / test123
✅ Passenger: 0300-3333333 / test123

✅ Driver: 0301-1111111 / test123  [approved]  Mirpur
✅ Driver: 0301-2222222 / test123  [approved]  Mirpur
✅ Driver: 0301-3333333 / test123  [approved]  Islamgarh
✅ Driver: 0301-4444444 / test123  [pending]   Mirpur

✅ Sample ride created.

🎉 Database seeded successfully!
```

If you see all those green checkmarks = database is ready ✅

---

## STEP 7 — OPEN THE WEBSITE

1. In VS Code, open the `frontend` folder
2. Right-click on `index.html`
3. Click "Open with Live Server"
4. Your browser opens at: http://127.0.0.1:5500
5. The website appears with full styling

**IMPORTANT: Always open via Live Server, never by double-clicking the HTML file.**
Double-clicking opens as file:// which blocks fonts and CSS.

---

## STEP 8 — VERIFY BACKEND IS WORKING

Open your browser and go to:
```
http://localhost:5000
```

You should see:
```json
{ "message": "🚗 RidePK Backend Running", "version": "2.0.0", "status": "ok" }
```

If you see this = backend is running correctly ✅

---

## STEP 9 — SET UP EMAIL NOTIFICATIONS (optional but recommended)

This sends you a Gmail when drivers/passengers register.

1. Go to your Gmail (must be a Gmail account)
2. Click your profile photo → Manage your Google Account
3. Click "Security" tab
4. Scroll down to "2-Step Verification" — you must turn this ON first
5. After turning on 2FA, search for "App passwords" in the search bar at top
6. Click "App passwords"
7. Select app: Mail
8. Select device: Windows Computer
9. Click "Generate"
10. You get a 16-character password like: abcd efgh ijkl mnop
11. Copy it (no spaces needed)

Now edit `backend/.env`:
```
EMAIL_USER=your_actual_gmail@gmail.com
EMAIL_PASS=abcdefghijklmnop
ADMIN_EMAIL=your_actual_gmail@gmail.com
```

Save and restart the server (Ctrl+C then `npm run dev` again).

Test by registering a new driver. You should get an email within 30 seconds.

If email does not work:
- Double-check App Password was copied correctly
- Make sure 2-Step Verification is on
- The system still works without email — it just skips silently

---

## HOW TO TEST — STEP BY STEP

### Test 1: Admin Login
1. Open: http://127.0.0.1:5500/admin-login.html
2. Username: admin
3. Password: RidePK@Admin2024
4. Click "Login to Admin Panel"
5. You should land on the admin dashboard
6. You should see stats cards (drivers, passengers, rides)
7. ✅ Admin login works

### Test 2: View Dashboard Stats
1. Check that stats show numbers (not 0 for everything)
2. You should see: 3 passengers, 4 drivers, 1 pending driver
3. ✅ Stats working

### Test 3: Approve a Driver (Zubair Malik)
1. Click "Drivers" in the left sidebar
2. You see 4 drivers in the table
3. Zubair Malik shows status "pending"
4. Click "✅ Approve"
5. Confirm the popup
6. Status changes to "approved"
7. ✅ Driver approval working

### Test 4: View Driver Photos
1. Click "👁 View" next to any driver
2. A popup (modal) opens
3. Scroll down to "📸 Uploaded Documents"
4. For test drivers: photos show "Not uploaded" (because seedDB doesn't upload real files)
5. For REAL drivers who register: photos will appear
6. Click any photo → it opens full size
7. ✅ Photo viewing working

### Test 5: Driver Login
1. Open a new browser tab
2. Go to: http://127.0.0.1:5500/login.html
3. Select "Driver" tab
4. Phone: 0301-1111111
5. Password: test123
6. Click Login
7. You should land on driver-dashboard.html
8. ✅ Driver login working

### Test 6: Driver Goes Online
1. In driver dashboard, toggle the switch in top-right corner to "Online"
2. The switch turns green
3. Label changes to "Online ✅"
4. ✅ Online toggle working

### Test 7: Passenger Books a Ride (REAL ROAD MAP TEST)
1. Open a new browser tab (or window)
2. Go to: http://127.0.0.1:5500/login.html
3. Select "Passenger" tab
4. Phone: 0300-1111111
5. Password: test123
6. You land on passenger-dashboard
7. Click "Book a Ride" button
8. Map opens, centered on Mirpur AJK
9. Click on map at one spot (green dot appears = pickup)
10. Click on another spot (orange dot appears = destination)
11. Wait 2–3 seconds
12. You should see a REAL ROAD route drawn on the map (orange line following roads)
    — NOT a straight dashed line
13. Distance shows in km (based on real road length)
14. Time shows in minutes
15. Suggested price shows (Rs.40/km, minimum Rs.100)
16. Click "Set Price →"
17. Enter a price (e.g. 350)
18. Choose payment method
19. Click "Review →"
20. See summary with correct distance and price
21. Click "🚗 Find a Driver"
22. System creates ride in database
23. Driver cards appear showing available drivers
24. Every 8 seconds, next driver card appears
25. ✅ Real road routing + auto-pass working

### Test 8: Driver Sees Ride Request
1. Go back to the driver dashboard tab
2. Click "Ride Requests" in sidebar
3. You should see the request from the passenger
4. It shows: passenger name, pickup, destination, distance, offered price
5. Click "Accept"
6. Passenger sees in their booking screen that driver accepted
7. ✅ Ride request flow working

### Test 9: Driver Registration with Mandatory Documents
1. Go to: http://127.0.0.1:5500/driver-register.html
2. Fill in all personal info (step 1)
3. Fill in vehicle info (step 2)
4. On step 3 (Documents): DO NOT upload any files
5. Click "Submit Application ✓"
6. You should see an error message listing which files are missing
7. Now upload one file (e.g. CNIC Front)
8. Try to submit again
9. Error now shows only the 5 missing files
10. Upload all 6 files
11. Submit
12. Success message appears
13. ✅ Mandatory document validation working

### Test 10: Passenger Approval System
1. Go to admin dashboard → Settings
2. Toggle "Require admin approval for new passengers" to ON
3. Now open: http://127.0.0.1:5500/register.html
4. Register a new passenger (different phone number)
5. You should see: "Account created! Please wait for admin approval"
6. This passenger CANNOT login yet
7. Go to admin dashboard → Passengers
8. Filter by "Pending Approval"
9. You see the new passenger
10. Click "✅ Approve"
11. Now the passenger can login
12. ✅ Passenger approval working

### Test 11: Freeze an Account
1. In admin → Drivers
2. Click "❄️ Freeze" next to a driver
3. Enter a reason (e.g. "Suspicious activity")
4. Driver account is frozen
5. Try to login as that driver
6. You get the error: "Account frozen. Reason: Suspicious activity. Contact admin."
7. Back in admin → click "🔓 Unfreeze"
8. Driver can login again
9. ✅ Freeze/unfreeze working

---

## TEST ACCOUNTS QUICK REFERENCE

**Admin:**
- URL: http://127.0.0.1:5500/admin-login.html
- Username: admin
- Password: RidePK@Admin2024

**Passengers (login.html → Passenger tab):**
- 0300-1111111 / test123
- 0300-2222222 / test123
- 0300-3333333 / test123

**Drivers (login.html → Driver tab):**
- 0301-1111111 / test123  Mirpur, ONLINE, subscription active
- 0301-2222222 / test123  Mirpur, ONLINE, subscription active
- 0301-3333333 / test123  Islamgarh, offline
- 0301-4444444 / test123  Mirpur, PENDING (approve from admin first)

---

## HOW REAL ROAD ROUTING WORKS

The map uses two free services:
1. **OpenStreetMap** — the map tiles (what you see)
2. **OSRM (router.project-osrm.org)** — the road routing engine

When you set pickup and destination:
- The system calls OSRM API: "Give me the road route between these two GPS points"
- OSRM returns the exact road path
- The map draws that road path as an orange line
- Distance = real road distance (not straight line)
- Time = estimated based on road speed limits

If OSRM is temporarily unavailable (rare):
- System falls back to straight line with dashed style
- Distance is calculated as straight line (less accurate)

No API key needed. Both services are completely free.

---

## HOW AUTO-PASS TO NEXT DRIVER WORKS

When passenger clicks "Find a Driver":
1. System creates the ride in database
2. Gets list of all online drivers near pickup location
3. Shows first driver card immediately
4. After 8 seconds — if not accepted — shows second driver card
5. After another 8 seconds — shows third driver card
6. And so on until all nearby drivers are shown
7. If no driver accepts: shows "No drivers responded" message
8. Via Socket.io: all online drivers also receive the request notification instantly

---

## HOW DRIVER SUBSCRIPTION WORKS

1. Driver registers and gets approved by admin
2. Driver must pay subscription before going online:
   - Monthly: Rs. 300/month
   - Annual: Rs. 3,000/year
3. Driver pays via Cash, EasyPaisa, or JazzCash
4. Driver takes screenshot of payment
5. Goes to dashboard → Subscription section
6. Uploads screenshot as proof
7. Admin receives email notification
8. Admin goes to admin dashboard → Subscriptions tab
9. Admin clicks "View Proof" to see the screenshot
10. Admin clicks "✅ Approve" if payment is genuine
11. Driver subscription activates for 1 month or 1 year
12. Driver can now toggle Online and take rides

If subscription expires:
- Driver cannot toggle Online
- Admin can freeze the account from admin panel
- Driver must pay again and submit proof

---

## HOW EMAIL NOTIFICATIONS WORK

Admin receives Gmail for:
- New driver registration
- New passenger registration
- Subscription payment proof submitted

Driver/passenger receives Gmail for:
- Their account is approved
- (if they provided email during registration)

If email is not configured: system works normally, just no emails.
No errors. Emails are completely optional.

---

## PRICING FORMULA

- Rate: Rs. 40 per km
- Minimum: Rs. 100 (cannot go below this)
- Economy: Rs. 40/km
- Comfort:  Rs. 40 × 1.4 = Rs. 56/km
- Intercity: Rs. 40 × 2.0 = Rs. 80/km

Examples:
- 3km economy = Rs. 120 (3 × 40)
- 2km economy = Rs. 100 (would be 80 but minimum applies)
- 10km intercity = Rs. 800 (10 × 80)
- 5km comfort = Rs. 280 (5 × 56)

Driver can counter-offer but minimum counter is also Rs. 100.

---

## CANCEL RIDE

When passenger cancels:
1. System asks for a reason (small input appears)
2. Reason is saved in database
3. Driver sees it in their ride history
4. Admin sees it in the Rides table (red text in Cancel Reason column)

---

## CITIES COVERED

Within Mirpur AJK Division:
- Mirpur → Islamgarh → Dadyal → Chakswari → Bhimber → Kotli → Rawalakot

Intercity routes:
- Mirpur → Islamabad
- Mirpur → Rawalpindi
- Mirpur → Lahore
- Islamgarh → Gujrat
- Islamgarh → Gujranwala
- Bhimber → Sialkot
- Dadyal → Jhelum

---

## GOING LIVE ON INTERNET

You need:
1. A domain name (e.g. ridepk.pk or ridepk.com)
   - Buy from: pknic.net.pk (for .pk) or namecheap.com
   - Cost: Rs. 2,000–4,000/year

2. A VPS server
   - Recommended: DigitalOcean $6/month
   - Go to digitalocean.com → Create Droplet → Ubuntu 22.04 → Basic → $6/month

After getting server, run these commands via SSH:
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Upload your backend folder (use FileZilla FTP)
# Then:
cd /home/ubuntu/backend
npm install

# Install PM2 (keeps server running always)
npm install -g pm2
pm2 start server.js --name ridepk
pm2 save
pm2 startup
```

Update frontend for live:
1. Open `frontend/js/api.js`
2. Change line:
   ```js
   const API_BASE = window.RIDEPK_API_BASE || 'http://localhost:5000';
   ```
   Update your html files so they set:
   ```html
   <script>window.RIDEPK_API_BASE = 'https://api.YOUR-DOMAIN.pk';</script>
   ```
   (Add this line before loading api.js in each HTML file)

3. Upload frontend folder to your server
4. Get free HTTPS: `sudo certbot --nginx -d YOUR-DOMAIN.pk`

---

## COMMON ERRORS AND FIXES

**Error: "Cannot find module '../config/mailer'"**
Fix: Make sure `backend/config/mailer.js` exists. It's in the ZIP.

**Error: "ENOTFOUND" or DNS errors during npm install**
Fix: Change your DNS to 8.8.8.8 (Google DNS) in Windows Network Settings.

**Error: "MongoDB connection failed"**
Fix:
- Check MONGO_URI in .env is correct
- In Atlas → Network Access → must have 0.0.0.0/0
- Try pinging: ping cluster0.xxxxx.mongodb.net

**Error: Map shows straight line not road route**
This means OSRM (routing server) is temporarily unavailable.
Wait a minute and refresh the booking page. It's a free public server.

**Error: "Subscription expired" when driver tries to go online**
Fix: Admin must approve the driver's subscription payment first.

**Error: Pages look unstyled (plain black text)**
Fix: You opened HTML by double-clicking. Always use VS Code → Live Server → right-click index.html → Open with Live Server.

**Error: "Port 5000 already in use"**
Fix: Open Task Manager → find Node.js → End Task. Then run `npm run dev` again.

**Error: Driver registration says documents missing even though I uploaded**
This only happens if the backend is not running. Make sure `npm run dev` is active in terminal.

---

## API ENDPOINTS REFERENCE

```
POST  /api/auth/register              Register new passenger
POST  /api/auth/login                 Login (passenger or driver)
GET   /api/auth/me                    Get current user

GET   /api/users/profile              Passenger profile
PUT   /api/users/profile              Update passenger profile
PUT   /api/users/change-password      Change password

POST  /api/drivers/register           Submit driver application (with files)
GET   /api/drivers/nearby             Find online drivers near location
GET   /api/drivers/profile            Driver profile (needs token)
PUT   /api/drivers/toggle-online      Go online / offline
GET   /api/drivers/earnings           Earnings summary
POST  /api/drivers/subscription/pay   Submit subscription proof

POST  /api/rides/create               Book a ride
GET   /api/rides/my                   My ride history
GET   /api/rides/price                Calculate suggested price
GET   /api/rides/:id                  Get one ride
PUT   /api/rides/:id/accept           Driver accepts ride
PUT   /api/rides/:id/arrived          Driver arrived at pickup
PUT   /api/rides/:id/start            Ride started
PUT   /api/rides/:id/complete         Ride completed
PUT   /api/rides/:id/cancel           Cancel ride (with reason)
POST  /api/rides/:id/rate             Rate after ride

POST  /api/admin/login                Admin login
GET   /api/admin/stats                Dashboard stats
GET   /api/admin/activity             Recent activity log
GET   /api/admin/settings             Admin settings
PUT   /api/admin/settings             Update settings (approval mode, email)
GET   /api/admin/drivers              All drivers
GET   /api/admin/drivers/:id          Driver detail with photo URLs
PUT   /api/admin/drivers/:id/approve  Approve driver
PUT   /api/admin/drivers/:id/reject   Reject driver
PUT   /api/admin/drivers/:id/suspend  Freeze/unfreeze driver
DELETE /api/admin/drivers/:id         Delete driver
PUT   /api/admin/drivers/:id/subscription  Approve/reject subscription
GET   /api/admin/subscriptions/pending   Pending sub payments
GET   /api/admin/passengers           All passengers
PUT   /api/admin/passengers/:id/approve  Approve pending passenger
PUT   /api/admin/passengers/:id/freeze   Freeze passenger
DELETE /api/admin/passengers/:id      Delete passenger
GET   /api/admin/rides                All rides
PUT   /api/admin/change-password      Change admin password
```

---

*RidePK v3.0 — Mirpur AJK 🇵🇰*
