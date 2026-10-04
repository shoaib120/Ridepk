// scripts/seedDB.js — Seeds test data + creates admin account
// ✅ Run from the PROJECT ROOT:   node scripts/seedDB.js
// ✅ Or from inside scripts/:     node seedDB.js

const path = require('path');
// Load .env correctly no matter which folder you run from
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const User   = require('../models/User');
const Driver = require('../models/Driver');
const Ride   = require('../models/Ride');
const Admin  = require('../models/Admin');

const testPassengers = [
  { name: 'Ali Hassan',  phone: '0300-1111111', email: 'ali@test.com',    password: 'test123' },
  { name: 'Fatima Khan', phone: '0300-2222222', email: 'fatima@test.com', password: 'test123' },
  { name: 'Usman Ahmed', phone: '0300-3333333', email: 'usman@test.com',  password: 'test123' }
];

const testDrivers = [
  {
    fullName: 'Ahmed Khan', phone: '0301-1111111', email: 'ahmed.driver@test.com',
    password: 'test123', cnic: '35201-1234567-1', city: 'Mirpur',
    serviceType: 'Both City & Intercity',
    vehicle: { make: 'Toyota', model: 'Corolla', year: 2019, color: 'White', plate: 'MRP-1234', type: 'car' },
    status: 'approved', isOnline: true,
    location: { type: 'Point', coordinates: [73.7468, 33.1483] },
    rating: { average: 4.9, count: 45 }, completedRides: 45
  },
  {
    fullName: 'Muhammad Bilal', phone: '0301-2222222', email: 'bilal.driver@test.com',
    password: 'test123', cnic: '35202-2345678-2', city: 'Mirpur',
    serviceType: 'City Rides Only',
    vehicle: { make: 'Suzuki', model: 'Alto', year: 2021, color: 'Silver', plate: 'MRP-5678', type: 'car' },
    status: 'approved', isOnline: true,
    location: { type: 'Point', coordinates: [73.7500, 33.1500] },
    rating: { average: 4.7, count: 32 }, completedRides: 32
  },
  {
    fullName: 'Tariq Mahmood', phone: '0301-3333333', email: 'tariq.driver@test.com',
    password: 'test123', cnic: '35203-3456789-3', city: 'Kotli',
    serviceType: 'Both City & Intercity',
    vehicle: { make: 'Honda', model: 'Civic', year: 2020, color: 'Black', plate: 'KTL-9012', type: 'car' },
    status: 'approved', isOnline: false,
    location: { type: 'Point', coordinates: [73.9022, 33.5150] },
    rating: { average: 4.8, count: 60 }, completedRides: 60
  },
  {
    fullName: 'Zubair Shah', phone: '0301-4444444', email: 'zubair.driver@test.com',
    password: 'test123', cnic: '35204-4567890-4', city: 'Mirpur',
    serviceType: 'City Rides Only',
    vehicle: { make: 'Suzuki', model: 'Mehran', year: 2018, color: 'Red', plate: 'MRP-3456', type: 'car' },
    status: 'pending', isOnline: false,
    location: { type: 'Point', coordinates: [73.7468, 33.1483] },
    rating: { average: 5.0, count: 0 }, completedRides: 0
  }
];

const seed = async () => {
  try {
    console.log('');
    console.log('🔌 Connecting to MongoDB...');

    if (!process.env.MONGO_URI) {
      console.error('❌ ERROR: MONGO_URI is not set in your .env file!');
      console.error('   Make sure your .env file exists in the backend folder with:');
      console.error('   MONGO_URI=mongodb+srv://...');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected!\n');

    console.log('🗑️  Clearing old data...');
    await User.deleteMany({});
    await Driver.deleteMany({});
    await Ride.deleteMany({});
    await Admin.deleteMany({});
    console.log('✅ Cleared.\n');

    /* ── ADMIN ── */
    console.log('🔐 Creating admin account...');
    await Admin.create({ username: 'admin', password: 'RidePK@Admin2024', email: 'admin@ridepk.com' });
    console.log('   ✅ Admin created.\n');

    /* ── PASSENGERS ── */
    console.log('👤 Creating test passengers...');
    var createdPassengers = [];
    for (var i = 0; i < testPassengers.length; i++) {
      var p = testPassengers[i];
      var u = await User.create(p);
      createdPassengers.push(u);
      console.log('   ✅ ' + p.name + '  |  ' + p.phone + '  |  password: ' + p.password);
    }

    /* ── DRIVERS ── */
    console.log('\n🚗 Creating test drivers...');
    var createdDrivers = [];
    for (var j = 0; j < testDrivers.length; j++) {
      var d = testDrivers[j];
      var dr = await Driver.create(d);
      createdDrivers.push(dr);
      console.log('   ✅ ' + d.fullName + '  |  ' + d.phone + '  |  ' + d.status + '  |  password: ' + d.password);
    }

    /* ── SAMPLE RIDE ── */
    console.log('\n🛣️  Creating sample completed ride...');
    var sampleRide = await Ride.create({
      passengerName:  'Ali Hassan',
      passengerPhone: '0300-1111111',
      passenger:      createdPassengers[0]._id,
      driver:         createdDrivers[0]._id,
      pickup: {
        address: 'Chowk Shaheedan, Mirpur AJK',
        coordinates: { lat: 33.1497, lng: 73.7511 }
      },
      destination: {
        address: 'New City Phase 2, Mirpur AJK',
        coordinates: { lat: 33.1620, lng: 73.7650 }
      },
      vehicleType:  'car',
      offeredPrice: 120,
      finalPrice:   120,
      distanceKm:    2.8,
      durationMin:   12,
      status:        'completed',
      completedAt:   new Date()
    });
    console.log('   ✅ Sample ride created:', sampleRide._id);

    console.log('\n🎉 ================================');
    console.log('🎉  Database seeded successfully!');
    console.log('🎉 ================================\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ADMIN LOGIN  →  admin-login.html');
    console.log('  Username:  admin');
    console.log('  Password:  RidePK@Admin2024');
    console.log('');
    console.log('PASSENGER LOGIN  →  login.html  (role = Passenger)');
    testPassengers.forEach(function(p){ console.log('  Phone: ' + p.phone + '  |  Password: ' + p.password); });
    console.log('');
    console.log('DRIVER LOGIN  →  driver-login.html');
    testDrivers.filter(function(d){ return d.status === 'approved'; }).forEach(function(d){
      console.log('  Phone: ' + d.phone + '  |  Password: ' + d.password + '  |  City: ' + d.city);
    });
    console.log('');
    console.log('⚠️  Zubair Shah (0301-4444444) is PENDING — needs admin approval first.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.message && err.message.includes('ENOTFOUND')) {
      console.error('   → Cannot reach MongoDB. Check your MONGO_URI in .env file.');
    }
    if (err.message && err.message.includes('duplicate key')) {
      console.error('   → Duplicate key error. Run the seed again — it clears data first.');
    }
    process.exit(1);
  }
};

seed();