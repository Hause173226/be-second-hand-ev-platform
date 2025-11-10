const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/second-hand-ev';

const appointmentSchema = new mongoose.Schema({}, { strict: false, collection: 'appointments' });
const Appointment = mongoose.model('Appointment', appointmentSchema);

const listingSchema = new mongoose.Schema({}, { strict: false, collection: 'listings' });
const Listing = mongoose.model('Listing', listingSchema);

const contractSchema = new mongoose.Schema({}, { strict: false, collection: 'contracts' });
const Contract = mongoose.model('Contract', contractSchema);

const auctionSchema = new mongoose.Schema({}, { strict: false, collection: 'auctions' });
const Auction = mongoose.model('Auction', auctionSchema);

const depositRequestSchema = new mongoose.Schema({}, { strict: false, collection: 'depositrequests' });
const DepositRequest = mongoose.model('DepositRequest', depositRequestSchema);

async function updateCompletedListingsStatus() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Tìm tất cả appointments đã COMPLETED
    const completedAppointments = await Appointment.find({ status: 'COMPLETED' })
      .populate('depositRequestId')
      .populate('auctionId');

    console.log(`📋 Found ${completedAppointments.length} completed appointments`);

    let updatedCount = 0;

    for (const appointment of completedAppointments) {
      let listingId = null;

      // Xác định listingId từ appointment
      if (appointment.appointmentType === 'AUCTION' && appointment.auctionId) {
        // Appointment từ đấu giá
        const auction = await Auction.findById(appointment.auctionId);
        if (auction) {
          listingId = auction.listingId;
        }
      } else if (appointment.depositRequestId) {
        // Appointment từ deposit request
        const depositRequest = await DepositRequest.findById(appointment.depositRequestId);
        if (depositRequest) {
          listingId = depositRequest.listingId;
        }
      }

      if (listingId) {
        const listing = await Listing.findById(listingId);
        
        if (listing && listing.status !== 'Sold') {
          console.log(`🔄 Updating listing ${listingId} from "${listing.status}" to "Sold"`);
          listing.status = 'Sold';
          await listing.save();
          updatedCount++;
        }
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

// Run migration
updateCompletedListingsStatus();
