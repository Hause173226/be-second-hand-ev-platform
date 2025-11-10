const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/second-hand-ev';

async function checkStatuses() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Kiểm tra tất cả statuses của contracts
    const contractStatuses = await db.collection('contracts').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    console.log('📄 Contract Statuses:');
    contractStatuses.forEach(s => {
      console.log(`   ${s._id}: ${s.count}`);
    });

    // Kiểm tra tất cả statuses của appointments
    const appointmentStatuses = await db.collection('appointments').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    console.log('\n📅 Appointment Statuses:');
    appointmentStatuses.forEach(s => {
      console.log(`   ${s._id}: ${s.count}`);
    });

    // Kiểm tra tất cả statuses của listings
    const listingStatuses = await db.collection('listings').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    console.log('\n🚗 Listing Statuses:');
    listingStatuses.forEach(s => {
      console.log(`   ${s._id}: ${s.count}`);
    });

    // Lấy một vài contracts mẫu
    const sampleContracts = await db.collection('contracts').find({}).limit(3).toArray();
    console.log('\n📋 Sample Contracts:');
    sampleContracts.forEach(c => {
      console.log(`   - ID: ${c._id}, Status: ${c.status}, CompletedAt: ${c.completedAt || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkStatuses();
