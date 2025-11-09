import AuctionDeposit from '../models/AuctionDeposit';
import Auction from '../models/Auction';
import walletService from './walletService';
import { Types } from 'mongoose';

// PHÍ CỌC THAM GIA ĐẤU GIÁ CỐ ĐỊNH
const AUCTION_PARTICIPATION_FEE = 1000000; // 1 triệu VNĐ

export const auctionDepositService = {
  /**
   * Đặt cọc để tham gia đấu giá
   * - Phí cọc cố định: 1,000,000 VNĐ
   * - Kiểm tra số dư ví
   * - Freeze tiền cọc từ ví người dùng
   * - Tạo record AuctionDeposit
   */
  async createAuctionDeposit(auctionId: string, userId: string) {
    // Kiểm tra auction có tồn tại không
    const auction = await Auction.findById(auctionId).populate('listingId');
    if (!auction) {
      throw new Error('Không tìm thấy phiên đấu giá');
    }

    // Kiểm tra user có phải là seller của sản phẩm không
    const listing = auction.listingId as any;
    if (listing.sellerId.toString() === userId.toString()) {
      throw new Error('Bạn không thể đặt cọc cho sản phẩm của chính mình');
    }

    // Kiểm tra trạng thái auction
    if (auction.status !== 'active') {
      throw new Error('Phiên đấu giá đã kết thúc hoặc bị hủy');
    }

    // Kiểm tra thời gian
    const now = new Date();
    if (now > auction.endAt) {
      throw new Error('Phiên đấu giá đã hết hạn');
    }

    // Kiểm tra user đã đặt cọc chưa
    const existingDeposit = await AuctionDeposit.findOne({
      auctionId: new Types.ObjectId(auctionId),
      userId: new Types.ObjectId(userId),
      status: 'FROZEN'
    });

    if (existingDeposit) {
      throw new Error('Bạn đã đặt cọc cho phiên đấu giá này rồi');
    }

    // Kiểm tra số dư ví (PHÍ CỐ ĐỊNH 1 TRIỆU)
    const wallet = await walletService.getWallet(userId);
    if (wallet.balance < AUCTION_PARTICIPATION_FEE) {
      throw new Error(`Số dư không đủ. Cần ${AUCTION_PARTICIPATION_FEE.toLocaleString('vi-VN')} VNĐ để đặt cọc tham gia đấu giá`);
    }

    // Freeze tiền từ ví (PHÍ CỐ ĐỊNH 1 TRIỆU)
    await walletService.freezeAmount(
      userId,
      AUCTION_PARTICIPATION_FEE,
      `Đặt cọc tham gia đấu giá #${auctionId}`
    );

    // Tạo record deposit với PHÍ CỐ ĐỊNH
    const deposit = await AuctionDeposit.create({
      auctionId: new Types.ObjectId(auctionId),
      userId: new Types.ObjectId(userId),
      depositAmount: AUCTION_PARTICIPATION_FEE,
      status: 'FROZEN',
      frozenAt: new Date()
    });

    return deposit;
  },

  /**
   * Hoàn tiền cọc cho tất cả người tham gia (trừ người thắng)
   * Được gọi khi auction kết thúc
   */
  async refundNonWinners(auctionId: string, winnerId?: string) {
    const deposits = await AuctionDeposit.find({
      auctionId: new Types.ObjectId(auctionId),
      status: 'FROZEN'
    });

    const refundPromises = deposits.map(async (deposit) => {
      // Nếu là người thắng, bỏ qua (sẽ xử lý riêng)
      if (winnerId && deposit.userId.toString() === winnerId.toString()) {
        return null;
      }

      // Hoàn tiền về ví
      await walletService.unfreezeAmount(
        deposit.userId.toString(),
        deposit.depositAmount,
        `Hoàn tiền cọc đấu giá #${auctionId}`
      );

      // Cập nhật trạng thái deposit
      deposit.status = 'REFUNDED';
      deposit.refundedAt = new Date();
      await deposit.save();

      return deposit;
    });

    const results = await Promise.all(refundPromises);
    return results.filter(r => r !== null);
  },

  /**
   * Chiết khấu tiền cọc của người thắng vào giá bán
   * Được gọi khi tạo Order/Payment
   */
  async deductWinnerDeposit(auctionId: string, winnerId: string) {
    const deposit = await AuctionDeposit.findOne({
      auctionId: new Types.ObjectId(auctionId),
      userId: new Types.ObjectId(winnerId),
      status: 'FROZEN'
    });

    if (!deposit) {
      throw new Error('Không tìm thấy tiền cọc của người thắng cuộc');
    }

    // Giảm frozenAmount (tiền đã được freeze từ trước)
    const wallet = await walletService.getWallet(winnerId);
    wallet.frozenAmount -= deposit.depositAmount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();

    // Cập nhật trạng thái deposit
    deposit.status = 'DEDUCTED';
    deposit.deductedAt = new Date();
    await deposit.save();

    return deposit;
  },

  /**
   * Hủy đặt cọc (trước khi đấu giá bắt đầu)
   */
  async cancelDeposit(auctionId: string, userId: string) {
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Không tìm thấy phiên đấu giá');
    }

    // Chỉ cho phép hủy trước khi đấu giá bắt đầu
    const now = new Date();
    if (now >= auction.startAt) {
      throw new Error('Không thể hủy cọc sau khi đấu giá đã bắt đầu');
    }

    const deposit = await AuctionDeposit.findOne({
      auctionId: new Types.ObjectId(auctionId),
      userId: new Types.ObjectId(userId),
      status: 'FROZEN'
    });

    if (!deposit) {
      throw new Error('Không tìm thấy tiền cọc');
    }

    // Hoàn tiền về ví
    await walletService.unfreezeAmount(
      userId,
      deposit.depositAmount,
      `Hủy cọc đấu giá #${auctionId}`
    );

    // Cập nhật trạng thái
    deposit.status = 'CANCELLED';
    deposit.cancelledAt = new Date();
    await deposit.save();

    return deposit;
  },

  /**
   * Lấy danh sách người đã đặt cọc cho 1 phiên đấu giá
   */
  async getAuctionDeposits(auctionId: string) {
    return await AuctionDeposit.find({
      auctionId: new Types.ObjectId(auctionId)
    })
      .populate('userId', 'fullName email avatar')
      .sort({ createdAt: -1 });
  },

  /**
   * Kiểm tra user đã đặt cọc chưa
   */
  async hasDeposited(auctionId: string, userId: string): Promise<boolean> {
    const deposit = await AuctionDeposit.findOne({
      auctionId: new Types.ObjectId(auctionId),
      userId: new Types.ObjectId(userId),
      status: 'FROZEN'
    });
    return !!deposit;
  },

  /**
   * Lấy thông tin deposit của user trong 1 auction
   */
  async getUserDeposit(auctionId: string, userId: string) {
    return await AuctionDeposit.findOne({
      auctionId: new Types.ObjectId(auctionId),
      userId: new Types.ObjectId(userId)
    });
  },

  /**
   * Lấy phí cọc tham gia đấu giá (cố định)
   */
  getParticipationFee(): number {
    return AUCTION_PARTICIPATION_FEE;
  }
};

export default auctionDepositService;
