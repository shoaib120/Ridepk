require('dotenv').config();
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const path       = require('path');
const connectDB  = require('./config/db');
const initSocket = require('./socket/socket');

const app    = express();
const server = http.createServer(app);

connectDB();

app.use(cors({ origin: (o, cb) => cb(null, true), credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',    require('./routes/authRoutes'));
app.use('/api/rides',   require('./routes/rideRoutes'));
const messageRoutes = require('./routes/messageRoutes');
app.use('/api/rides', messageRoutes);
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/users',   require('./routes/userRoutes'));
app.use('/api/admin',   require('./routes/adminRoutes'));

app.get('/', (req, res) => res.json({ message: '🚗 RidePK Backend Running', version: '2.0.0', status: 'ok' }));
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => res.status(500).json({ message: err.message }));

initSocket(server);

// ── Auto-cancel stale rides (stuck in 'searching' > 15 min) ──
const { cancelStaleRides } = require('./controllers/rideController');
cancelStaleRides();                               // run once on startup
setInterval(cancelStaleRides, 5 * 60 * 1000);    // then every 5 minutes

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('');
  console.log('🚗 ================================');
  console.log(`🚗  RidePK v2.0 — port ${PORT}`);
  console.log('🚗 ================================');
  console.log('');
});