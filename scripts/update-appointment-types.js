/**
 * Migration Script: Update appointmentType for existing appointments
 * 
 * Cập nhật appointmentType cho các appointment hiện có:
 * - Nếu có auctionId → appointmentType = 'AUCTION'
 * - Nếu có depositRequestId → appointmentType = 'NORMAL_DEPOSIT'
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/secondhand-ev';

async function updateAppointmentTypes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const appointmentsCollection = db.collection('appointments');

    // Đếm tổng số appointments
    const totalAppointments = await appointmentsCollection.countDocuments();
    console.log(`📊 Total appointments: ${totalAppointments}`);

    // Đếm appointments chưa có appointmentType
    const missingType = await appointmentsCollection.countDocuments({
      appointmentType: { $exists: false }
    });
    console.log(`⚠️  Appointments missing appointmentType: ${missingType}`);

    if (missingType === 0) {
      console.log('✅ All appointments already have appointmentType');
      await mongoose.disconnect();
      return;
    }

    // Update appointments có auctionId
    console.log('\n🔄 Updating appointments with auctionId...');
    const auctionResult = await appointmentsCollection.updateMany(
      {
        auctionId: { $exists: true, $ne: null },
        appointmentType: { $exists: false }
      },
      {
        $set: { appointmentType: 'AUCTION' }
      }
    );
    console.log(`✅ Updated ${auctionResult.modifiedCount} auction appointments`);

    // Update appointments có depositRequestId
    console.log('\n🔄 Updating appointments with depositRequestId...');
    const depositResult = await appointmentsCollection.updateMany(
      {
        depositRequestId: { $exists: true, $ne: null },
        appointmentType: { $exists: false }
      },
      {
        $set: { appointmentType: 'NORMAL_DEPOSIT' }
      }
    );
    console.log(`✅ Updated ${depositResult.modifiedCount} normal deposit appointments`);

    // Kiểm tra còn appointments nào chưa có type không
    const stillMissing = await appointmentsCollection.countDocuments({
      appointmentType: { $exists: false }
    });

    if (stillMissing > 0) {
      console.log(`\n⚠️  Warning: ${stillMissing} appointments still missing appointmentType`);
      
      // Lấy danh sách để kiểm tra
      const orphanAppointments = await appointmentsCollection.find({
        appointmentType: { $exists: false }
      }).limit(5).toArray();
      
      console.log('Sample orphan appointments:');
      orphanAppointments.forEach(apt => {
        console.log(`  - ID: ${apt._id}, hasAuctionId: ${!!apt.auctionId}, hasDepositRequestId: ${!!apt.depositRequestId}`);
      });
    } else {
      console.log('\n✅ All appointments now have appointmentType');
    }

    // Tóm tắt kết quả
    console.log('\n📊 Summary:');
    const auctionCount = await appointmentsCollection.countDocuments({ appointmentType: 'AUCTION' });
    const depositCount = await appointmentsCollection.countDocuments({ appointmentType: 'NORMAL_DEPOSIT' });
    console.log(`  - AUCTION appointments: ${auctionCount}`);
    console.log(`  - NORMAL_DEPOSIT appointments: ${depositCount}`);
    console.log(`  - Total: ${auctionCount + depositCount}`);

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
updateAppointmentTypes()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
