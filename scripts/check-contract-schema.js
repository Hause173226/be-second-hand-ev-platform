const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/second-hand-ev';

async function checkContractSchema() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Lấy 1 contract mẫu để xem structure
    const sampleContract = await db.collection('contracts').findOne({ status: 'COMPLETED' });
    
    console.log('📋 Sample COMPLETED Contract:');
    console.log(JSON.stringify(sampleContract, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkContractSchema();
