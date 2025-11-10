const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/second-hand-ev';

async function updateAllCompletedListings() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Tìm tất cả contracts đã COMPLETED
    const completedContracts = await db.collection('contracts').find({
      status: 'COMPLETED'
    }).toArray();

    console.log(`\n📋 Found ${completedContracts.length} completed contracts`);

    let updatedCount = 0;

    for (const contract of completedContracts) {
      // Contract đã có listingId sẵn! (nhưng là string, cần convert)
      const listingId = contract.listingId;

      if (!listingId) {
        console.log(`⚠️  Contract ${contract._id} has no listingId`);
        continue;
      }

      // Convert string to ObjectId
      const listingObjectId = typeof listingId === 'string' 
        ? new mongoose.Types.ObjectId(listingId)
        : listingId;

      const listing = await db.collection('listings').findOne({
        _id: listingObjectId
      });
      
      if (listing && listing.status !== 'Sold') {
        console.log(`🔄 Updating listing ${listingId}:`);
        console.log(`   From: "${listing.status}"`);
        console.log(`   To: "Sold"`);
        console.log(`   Make/Model: ${listing.make} ${listing.model} ${listing.year}`);
        
        await db.collection('listings').updateOne(
          { _id: listingObjectId },
          { $set: { status: 'Sold' } }
        );
        
        updatedCount++;
      }
    }

    console.log(`\n✅ Migration completed!`);
    console.log(`   Updated ${updatedCount} listings to "Sold" status`);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

updateAllCompletedListings();
