const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/second-hand-ev';

async function checkListingAppointments() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const listingId = '68fe06b615983fc45139f0fd';
    const db = mongoose.connection.db;

    // Tìm tất cả deposit requests cho listing này
    const depositRequests = await db.collection('depositrequests').find({
      listingId: new mongoose.Types.ObjectId(listingId)
    }).toArray();
    
    console.log(`\n📋 Found ${depositRequests.length} deposit requests for listing ${listingId}`);
    
    if (depositRequests.length > 0) {
      const depositRequestIds = depositRequests.map(dr => dr._id);
      
      // Tìm appointments từ deposit requests
      const appointments = await db.collection('appointments').find({
        depositRequestId: { $in: depositRequestIds }
      }).toArray();
      
      console.log(`\n📅 Found ${appointments.length} appointments:`);
      appointments.forEach(a => {
        console.log(`   - ID: ${a._id}`);
        console.log(`     Status: ${a.status}`);
        console.log(`     Type: ${a.appointmentType || 'N/A'}`);
        console.log(`     Created: ${a.createdAt}`);
        console.log('');
      });
      
      if (appointments.length > 0) {
        const appointmentIds = appointments.map(a => a._id);
        
        // Tìm contracts
        const contracts = await db.collection('contracts').find({
          appointmentId: { $in: appointmentIds }
        }).toArray();
        
        console.log(`\n📄 Found ${contracts.length} contracts:`);
        contracts.forEach(c => {
          console.log(`   - ID: ${c._id}`);
          console.log(`     Status: ${c.status}`);
          console.log(`     Completed: ${c.completedAt || 'Not completed'}`);
          console.log('');
        });
      }
    }
    
    // Kiểm tra auctions
    const auctions = await db.collection('auctions').find({
      listingId: new mongoose.Types.ObjectId(listingId)
    }).toArray();
    
    console.log(`\n🔨 Found ${auctions.length} auctions for listing ${listingId}`);
    
    if (auctions.length > 0) {
      const auctionIds = auctions.map(a => a._id);
      
      const auctionAppointments = await db.collection('appointments').find({
        auctionId: { $in: auctionIds }
      }).toArray();
      
      console.log(`\n📅 Found ${auctionAppointments.length} auction appointments:`);
      auctionAppointments.forEach(a => {
        console.log(`   - ID: ${a._id}`);
        console.log(`     Status: ${a.status}`);
        console.log(`     Type: ${a.appointmentType || 'N/A'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkListingAppointments();
