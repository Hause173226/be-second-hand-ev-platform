// Script migrate dữ liệu cũ từ SystemWallet vào SystemWalletTransaction
// Chạy: node migrate-system-wallet-history.js

const mongoose = require('mongoose');
require('dotenv').config();

async function migrateData() {
  try {
    // Kết nối MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name');
    console.log('✅ Connected to MongoDB\n');

    // Import models
    const SystemWallet = mongoose.model('SystemWallet', new mongoose.Schema({}, { strict: false }));
    const SystemWalletTransaction = mongoose.model('SystemWalletTransaction', new mongoose.Schema({
      type: String,
      amount: Number,
      depositRequestId: String,
      appointmentId: String,
      description: String,
      balanceAfter: Number,
      createdAt: Date,
      updatedAt: Date
    }, { timestamps: true }));

    const Appointment = mongoose.model('Appointment', new mongoose.Schema({}, { strict: false }));
    const DepositRequest = mongoose.model('DepositRequest', new mongoose.Schema({}, { strict: false }));
    const EscrowAccount = mongoose.model('EscrowAccount', new mongoose.Schema({}, { strict: false }));

    // 1. Kiểm tra số lượng transaction hiện tại
    const existingTxCount = await SystemWalletTransaction.countDocuments();
    console.log(`📊 Số transaction hiện tại: ${existingTxCount}`);

    if (existingTxCount > 0) {
      console.log('⚠️  Đã có dữ liệu trong SystemWalletTransaction. Bạn có muốn tiếp tục? (có thể tạo duplicate)');
      console.log('   → Nếu muốn migrate lại, hãy xóa collection SystemWalletTransaction trước');
      return;
    }

    // 2. Tìm các appointments đã COMPLETED
    console.log('\n🔍 Đang tìm các appointments đã hoàn thành...');
    const completedAppointments = await Appointment.find({ 
      status: 'COMPLETED',
      completedAt: { $exists: true }
    }).sort({ completedAt: 1 });

    console.log(`   - Tìm thấy ${completedAppointments.length} appointments đã hoàn thành`);

    let completedCount = 0;
    let skippedCount = 0;
    for (const appointment of completedAppointments) {
      if (!appointment.depositRequestId) {
        console.log(`   ⚠️  Skip appointment ${appointment._id}: không có depositRequestId`);
        skippedCount++;
        continue;
      }

      const depositRequest = await DepositRequest.findById(appointment.depositRequestId);
      if (!depositRequest) {
        console.log(`   ⚠️  Skip appointment ${appointment._id}: không tìm thấy depositRequest ${appointment.depositRequestId}`);
        skippedCount++;
        continue;
      }

      // Kiểm tra escrow (không bắt buộc phải có RELEASED, vì có thể đã bị xóa hoặc chưa tạo)
      const escrow = await EscrowAccount.findOne({ depositRequestId: appointment.depositRequestId });
      
      // Nếu có escrow nhưng status không phải RELEASED, vẫn tiếp tục (vì appointment đã COMPLETED)
      if (escrow && escrow.status !== 'RELEASED') {
        console.log(`   ⚠️  Appointment ${appointment._id}: escrow status = ${escrow.status} (không phải RELEASED), nhưng vẫn migrate vì appointment đã COMPLETED`);
      }

      // Kiểm tra xem đã có transaction này chưa (tránh duplicate)
      const existingTx = await SystemWalletTransaction.findOne({
        appointmentId: appointment._id.toString(),
        type: 'COMPLETED'
      });

      if (existingTx) {
        console.log(`   ⚠️  Skip appointment ${appointment._id}: đã có transaction rồi`);
        skippedCount++;
        continue;
      }

      // Tạo transaction COMPLETED
      await SystemWalletTransaction.create({
        type: 'COMPLETED',
        amount: depositRequest.depositAmount,
        depositRequestId: appointment.depositRequestId,
        appointmentId: appointment._id.toString(),
        description: `Nhận tiền từ giao dịch đặt cọc ${appointment.depositRequestId} (100% tiền đặt cọc) - Migrated`,
        balanceAfter: 0, // Sẽ tính lại sau
        createdAt: appointment.completedAt || appointment.updatedAt,
        updatedAt: appointment.completedAt || appointment.updatedAt
      });

      completedCount++;
      console.log(`   ✅ Created transaction for appointment ${appointment._id} - Amount: ${depositRequest.depositAmount.toLocaleString('vi-VN')} VND`);
    }

    console.log(`   ✅ Đã tạo ${completedCount} transaction COMPLETED`);
    if (skippedCount > 0) {
      console.log(`   ⚠️  Đã skip ${skippedCount} appointments (thiếu dữ liệu hoặc đã có transaction)`);
    }

    // 3. Tìm các appointments đã CANCELLED
    console.log('\n🔍 Đang tìm các appointments đã hủy...');
    const cancelledAppointments = await Appointment.find({ 
      status: 'CANCELLED',
      cancelledAt: { $exists: true }
    }).sort({ cancelledAt: 1 });

    console.log(`   - Tìm thấy ${cancelledAppointments.length} appointments đã hủy`);

    let cancelledCount = 0;
    let cancelledSkippedCount = 0;
    for (const appointment of cancelledAppointments) {
      if (!appointment.depositRequestId) {
        cancelledSkippedCount++;
        continue;
      }

      const depositRequest = await DepositRequest.findById(appointment.depositRequestId);
      if (!depositRequest) {
        cancelledSkippedCount++;
        continue;
      }

      // Kiểm tra escrow (không bắt buộc phải có REFUNDED)
      const escrow = await EscrowAccount.findOne({ depositRequestId: appointment.depositRequestId });
      
      // Nếu có escrow nhưng status không phải REFUNDED, vẫn tiếp tục (vì appointment đã CANCELLED)
      if (escrow && escrow.status !== 'REFUNDED') {
        console.log(`   ⚠️  Appointment ${appointment._id}: escrow status = ${escrow.status} (không phải REFUNDED), nhưng vẫn migrate vì appointment đã CANCELLED`);
      }

      // Kiểm tra xem đã có transaction này chưa (tránh duplicate)
      const existingTx = await SystemWalletTransaction.findOne({
        appointmentId: appointment._id.toString(),
        type: 'CANCELLED'
      });

      if (existingTx) {
        cancelledSkippedCount++;
        continue;
      }

      // Tính phí hủy (20% tiền đặt cọc)
      const feeAmount = Math.round(depositRequest.depositAmount * 0.2);

      // Tạo transaction CANCELLED
      await SystemWalletTransaction.create({
        type: 'CANCELLED',
        amount: feeAmount,
        depositRequestId: appointment.depositRequestId,
        appointmentId: appointment._id.toString(),
        description: `Phí hủy giao dịch từ deposit ${appointment.depositRequestId} (20% tiền đặt cọc) - Migrated`,
        balanceAfter: 0, // Sẽ tính lại sau
        createdAt: appointment.cancelledAt || appointment.updatedAt,
        updatedAt: appointment.cancelledAt || appointment.updatedAt
      });

      cancelledCount++;
      console.log(`   ✅ Created transaction for appointment ${appointment._id} - Fee: ${feeAmount.toLocaleString('vi-VN')} VND`);
    }

    console.log(`   ✅ Đã tạo ${cancelledCount} transaction CANCELLED`);
    if (cancelledSkippedCount > 0) {
      console.log(`   ⚠️  Đã skip ${cancelledSkippedCount} appointments (thiếu dữ liệu hoặc đã có transaction)`);
    }

    // 4. Tính lại balanceAfter cho tất cả transactions (theo thứ tự thời gian)
    console.log('\n💰 Đang tính lại balanceAfter...');
    const allTransactions = await SystemWalletTransaction.find().sort({ createdAt: 1 });
    let currentBalance = 0;

    for (const tx of allTransactions) {
      currentBalance += tx.amount;
      tx.balanceAfter = currentBalance;
      await tx.save();
    }

    console.log(`   ✅ Đã cập nhật balanceAfter cho ${allTransactions.length} transactions`);

    // 5. Tổng kết
    const totalTx = await SystemWalletTransaction.countDocuments();
    const totalCompleted = await SystemWalletTransaction.countDocuments({ type: 'COMPLETED' });
    const totalCancelled = await SystemWalletTransaction.countDocuments({ type: 'CANCELLED' });

    console.log('\n📊 Tổng kết:');
    console.log(`   - Tổng số transactions: ${totalTx}`);
    console.log(`   - COMPLETED: ${totalCompleted}`);
    console.log(`   - CANCELLED: ${totalCancelled}`);

    const totalAmount = await SystemWalletTransaction.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    console.log(`   - Tổng số tiền: ${totalAmount[0]?.total?.toLocaleString('vi-VN') || 0} VND`);

    console.log('\n✅ Migration hoàn tất!');
    console.log('   → Bây giờ bạn có thể test API /api/system-wallet/transactions');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrateData();

