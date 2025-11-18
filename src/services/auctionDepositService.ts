import AuctionDeposit from '../models/AuctionDeposit';
import Auction from '../models/Auction';
import walletService from './walletService';
import { Types } from 'mongoose';

export const auctionDepositService = {
  /**
   * Đặt cọc để tham gia đấu giá
   * - Phí cọc: 10% startingPrice (hoặc priceListed) – fallback 1,000,000 VNĐ
   * - Kiểm tra số dư ví
   * - Freeze tiền cọc từ ví người dùng
   * - Tạo record AuctionDeposit
   */
  async createAuctionDeposit(auctionId: string, userId: string) {
    // 1. Kiểm tra auction tồn tại
    const auction = await Auction.findById(auctionId).populate('listingId');
    if (!auction) {
      throw new Error('Không tìm thấy phiên đấu giá');
    }

    const listing = auction.listingId as any;

    // 2. Không cho seller tự đặt cọc vào sản phẩm mình
    if (listing && listing.sellerId && listing.sellerId.toString() === userId.toString()) {
      throw new Error('Bạn không thể đặt cọc cho sản phẩm của chính mình');
    }

    // 3. Kiểm tra trạng thái phiên
    //   – Cho phép khi: approved / active / running
    //   – Không cho khi: cancelled / ended / closed ...
    const allowedStatuses = ['approved', 'active', 'running'];
    if (!allowedStatuses.includes(String(auction.status))) {
      throw new Error('Phiên đấu giá đã kết thúc hoặc bị hủy');
    }

    // 4. Kiểm tra approvalStatus - phải được duyệt
    if (auction.approvalStatus !== 'approved') {
      throw new Error('Phiên đấu giá chưa được phê duyệt');
    }

    // 5. Kiểm tra thời gian: chỉ chặn khi đã quá endAt
    const now = new Date();
    if (now > auction.endAt) {
      throw new Error('Phiên đấu giá đã hết hạn');
    }

    // 👉 BỎ điều kiện chặn sau khi bắt đầu
    // // Nếu bạn muốn vẫn chặn, thì giữ lại:
    // if (now > auction.startAt) {
    //   throw new Error('Phiên đấu giá đã bắt đầu, không thể đặt cọc');
    // }

    // 6. Kiểm tra user đã có deposit chưa (bất kể status)
    let existingDeposit = await AuctionDeposit.findOne({
      auctionId: new Types.ObjectId(auctionId),
      userId: new Types.ObjectId(userId),
    });

    // Nếu đã có deposit FROZEN → không cho đặt lại
    if (existingDeposit && existingDeposit.status === 'FROZEN') {
      throw new Error('Bạn đã đặt cọc cho phiên đấu giá này rồi');
    }

    // 7. Tính phí tham gia: dùng helper cho thống nhất
    const startingPrice =
      (auction && (auction as any).startingPrice) ||
      (listing && listing.priceListed) ||
      0;
    const participationFee =
      startingPrice > 0 ? Math.ceil(startingPrice * 0.1) : Math.ceil(startingPrice * 0.1);

    // 8. Kiểm tra số dư ví
    const wallet = await walletService.getWallet(userId);
    if (wallet.balance < participationFee) {
      throw new Error(
        `Số dư không đủ. Cần ${participationFee.toLocaleString(
          'vi-VN'
        )} VNĐ để đặt cọc tham gia đấu giá`
      );
    }

    // 9. Freeze tiền trong ví
    await walletService.freezeAmount(
      userId,
      participationFee,
      `Đặt cọc tham gia đấu giá #${auctionId}`
    );

    // 10. Nếu đã có deposit cũ (CANCELLED/REFUNDED) → update, nếu không → tạo mới
    let deposit;
    if (existingDeposit) {
      // Update deposit cũ
      existingDeposit.depositAmount = participationFee;
      existingDeposit.status = 'FROZEN';
      existingDeposit.frozenAt = new Date();
      existingDeposit.cancelledAt = undefined;
      existingDeposit.refundedAt = undefined;
      existingDeposit.deductedAt = undefined;
      await existingDeposit.save();
      deposit = existingDeposit;
    } else {
      // Tạo mới
      deposit = await AuctionDeposit.create({
        auctionId: new Types.ObjectId(auctionId),
        userId: new Types.ObjectId(userId),
        depositAmount: participationFee,
        status: 'FROZEN',
        frozenAt: new Date(),
      });
    }

    return deposit;
  },

  /**
   * Hoàn tiền cọc cho tất cả người tham gia (trừ người thắng)
   * Được gọi khi auction kết thúc
   */
  async refundNonWinners(auctionId: string, winnerId?: string) {
    const deposits = await AuctionDeposit.find({
      auctionId: new Types.ObjectId(auctionId),
      status: 'FROZEN',
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
    return results.filter((r) => r !== null);
  },

  /**
   * Chiết khấu tiền cọc của người thắng vào giá bán
   * Được gọi khi tạo Order/Payment
   */
  async deductWinnerDeposit(auctionId: string, winnerId: string) {
    const deposit = await AuctionDeposit.findOne({
      auctionId: new Types.ObjectId(auctionId),
      userId: new Types.ObjectId(winnerId),
      status: 'FROZEN',
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
      status: 'FROZEN',
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
      auctionId: new Types.ObjectId(auctionId),
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
      status: 'FROZEN',
    });
    return !!deposit;
  },

  /**
   * Lấy thông tin deposit của user trong 1 auction
   */
  async getUserDeposit(auctionId: string, userId: string) {
    return await AuctionDeposit.findOne({
      auctionId: new Types.ObjectId(auctionId),
      userId: new Types.ObjectId(userId),
    });
  },

  /**
   * Lấy phí cọc tham gia đấu giá.
   */
  getParticipationFee(auctionOrStartingPrice?: any): number {
    let startingPrice = 0;
    if (!auctionOrStartingPrice) {
      startingPrice = 0;
    } else if (typeof auctionOrStartingPrice === 'number') {
      startingPrice = auctionOrStartingPrice;
    } else if (auctionOrStartingPrice.startingPrice != null) {
      startingPrice = auctionOrStartingPrice.startingPrice;
    } else if (auctionOrStartingPrice.priceListed != null) {
      startingPrice = auctionOrStartingPrice.priceListed;
    }

    if (startingPrice > 0) return Math.ceil(startingPrice * 0.1);
    return 1_000_000;
  },
};

export default auctionDepositService;
