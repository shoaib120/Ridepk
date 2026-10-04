// =====================================================
//  config/db.js  —  MongoDB Connection
// =====================================================

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser:    true,
      useUnifiedTopology: true
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('   Make sure MongoDB is running or your MONGO_URI in .env is correct');
    process.exit(1); // Stop server if DB fails
  }
};

module.exports = connectDB;
