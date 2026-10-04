# server.js patch

Add these lines to your existing server.js AFTER the routes are set up:

## 1. Import cancelStaleRides

```js
const { cancelStaleRides } = require('./controllers/rideController');
```

## 2. Schedule auto-cancel (add after all app.use() calls, before app.listen())

```js
// Auto-cancel rides stuck in 'searching' for > 15 minutes
cancelStaleRides(); // Run once on startup
setInterval(cancelStaleRides, 5 * 60 * 1000); // Then every 5 minutes
```

## 3. Add forgot/reset password routes (if not already in authRoutes)

Make sure your authRoutes.js is mounted at /api/auth in server.js:

```js
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
```
