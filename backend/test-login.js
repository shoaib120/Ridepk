// =====================================================
//  test-login.js  —  Run this on Render shell to diagnose login
//  Usage: node test-login.js <phone> <password>
//  Example: node test-login.js 03001234567 mypassword123
// =====================================================
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const phone    = process.argv[2];
const password = process.argv[3];

if (!phone || !password) {
  console.log('Usage: node test-login.js <phone> <password>');
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const Driver = require('./models/Driver');
  const driver = await Driver.findOne({ phone });

  if (!driver) {
    console.log('❌ No driver found with phone:', phone);
    process.exit(1);
  }

  console.log('✅ Driver found:', driver.fullName);
  console.log('   Status:', driver.status);
  console.log('   Password hash in DB:', driver.password.substring(0, 20) + '...');
  console.log('   Hash starts with $2b$ or $2a$:', driver.password.startsWith('$2'));

  const match = await bcrypt.compare(password, driver.password);
  console.log('   bcrypt.compare result:', match);

  if (!match) {
    console.log('');
    console.log('❌ Password does NOT match.');
    console.log('   This means the password was double-hashed during registration.');
    console.log('   Fix: delete this driver record and register again.');
  } else {
    console.log('');
    console.log('✅ Password matches! Login should work.');
    console.log('   If login still fails, check driver status — must be "approved".');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
