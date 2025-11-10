const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/second-hand-ev';

async function debugListingStatus() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Lấy tất cả completed contracts
    const completedContracts = await db.collection('contracts').find({
      status: 'COMPLETED'
    }).toArray();

    console.log(`📋 Found ${completedContracts.length} completed contracts\n`);

    for (const contract of completedContracts) {
      console.log(`Contract ${contract._id}:`);
      console.log(`  ListingId: ${contract.listingId}`);
      console.log(`  ListingId type: ${typeof contract.listingId}`);
      
      const listing = await db.collection('listings').findOne({
        _id: contract.listingId
      });
      
      if (listing) {
        console.log(`  ✅ Listing found!`);
        console.log(`     Status: ${listing.status}`);
        console.log(`     Make/Model: ${listing.make} ${listing.model} ${listing.year}`);
        console.log(`     Needs update: ${listing.status !== 'Sold' ? 'YES' : 'NO'}`);
      } else {
        console.log(`  ❌ Listing NOT found`);
        
        // Try with ObjectId conversion
        const listingWithObjectId = await db.collection('listings').findOne({
          _id: new mongoose.Types.ObjectId(contract.listingId.toString())
        });
        
        if (listingWithObjectId) {
          console.log(`  ✅ Listing found with ObjectId conversion!`);
          console.log(`     Status: ${listingWithObjectId.status}`);
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugListingStatus();
