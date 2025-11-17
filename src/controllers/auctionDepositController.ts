import { Request, Response } from 'express';
import auctionDepositService from '../services/auctionDepositService';
import walletService from '../services/walletService';
import Auction from '../models/Auction';


export const createAuctionDeposit = async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.params;
    const userId = (req as any).user?._id || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    // Lấy thông tin auction và populate listing để kiểm tra seller
    const auction = await Auction.findById(auctionId).populate('listingId');
    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phiên đấu giá'
      });
    }

    // KIỂM TRA: User có phải là seller không?
    const listing = auction.listingId as any;
    if (listing.sellerId.toString() === userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không thể đặt cọc cho sản phẩm của chính mình'
      });
    }

    // Lấy phí cọc tính theo startingPrice của phiên đấu giá (10%)
    const participationFee = auctionDepositService.getParticipationFee(auction);

    // Kiểm tra số dư ví
    const wallet = await walletService.getWallet(userId);
    if (wallet.balance < participationFee) {
      // Không đủ tiền -> Tính số tiền còn thiếu và tạo link nạp tiền qua VNPay
      const missingAmount = participationFee - wallet.balance; // Số tiền còn thiếu
      
      const vnpayUrl = await walletService.createDepositUrl(
        userId.toString(),
        missingAmount, // ✅ Chỉ nạp số tiền còn thiếu
        `Nạp tiền đặt cọc tham gia đấu giá #${auctionId}`,
        req
      );

      return res.json({
        success: false,
        message: 'Số dư không đủ để đặt cọc',
        vnpayUrl: vnpayUrl,
        requiredAmount: participationFee, // Tổng tiền cần đặt cọc
        currentBalance: wallet.balance, // Số dư hiện tại
        missingAmount: missingAmount // Số tiền còn thiếu (chỉ cần nạp số này)
      });
    }

    // Đủ tiền -> Tạo deposit
    const deposit = await auctionDepositService.createAuctionDeposit(auctionId, userId);

    res.json({
      success: true,
      message: 'Đặt cọc thành công',
      data: {
        depositId: deposit._id,
        auctionId: deposit.auctionId,
        depositAmount: deposit.depositAmount,
        status: deposit.status,
        frozenAt: deposit.frozenAt
      }
    });

  } catch (error) {
    console.error('Error creating auction deposit:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống'
    });
  }
};


export const cancelAuctionDeposit = async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.params;
    const userId = (req as any).user?._id || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const deposit = await auctionDepositService.cancelDeposit(auctionId, userId);

    res.json({
      success: true,
      message: 'Hủy cọc thành công, tiền đã hoàn về ví',
      data: {
        depositId: deposit._id,
        refundedAmount: deposit.depositAmount,
        status: deposit.status
      }
    });

  } catch (error) {
    console.error('Error cancelling auction deposit:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống'
    });
  }
};


export const getAuctionDeposits = async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.params;

    const deposits = await auctionDepositService.getAuctionDeposits(auctionId);

    res.json({
      success: true,
      data: deposits,
      total: deposits.length
    });

  } catch (error) {
    console.error('Error getting auction deposits:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống'
    });
  }
};

export const checkDepositStatus = async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.params;
    const userId = (req as any).user?._id || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const deposit = await auctionDepositService.getUserDeposit(auctionId, userId);
    const hasDeposited = await auctionDepositService.hasDeposited(auctionId, userId);

    // ✅ TRẢ RA ĐÚNG FORMAT FE ĐANG DÙNG (hasDeposit, deposit ở top-level)
    return res.json({
      success: true,
      hasDeposit: hasDeposited,
      deposit: deposit || null,
      // Giữ thêm field data cũ để không phá chỗ khác
      data: {
        hasDeposited,
        deposit: deposit || null
      }
    });

  } catch (error) {
    console.error('Error checking deposit status:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống'
    });
  }
};


export const deductWinnerDeposit = async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.params;
    const { winnerId } = req.body;

    if (!winnerId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu winnerId'
      });
    }

    const deposit = await auctionDepositService.deductWinnerDeposit(auctionId, winnerId);

    res.json({
      success: true,
      message: 'Đã chiết khấu tiền cọc của người thắng',
      data: {
        depositId: deposit._id,
        deductedAmount: deposit.depositAmount,
        status: deposit.status,
        deductedAt: deposit.deductedAt
      }
    });

  } catch (error) {
    console.error('Error deducting winner deposit:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống'
    });
  }
};

/**
 * Lấy phí cọc tham gia đấu giá
 * GET /api/auctions/deposit/fee
 */
export const getParticipationFee = async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.query;

    let fee: number;
    if (auctionId) {
      const auction = await Auction.findById(auctionId as string);
      if (!auction) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy auction' });
      }
      fee = auctionDepositService.getParticipationFee(auction);
    } else {
      // Không có auctionId -> trả về giá trị mặc định (fallback)
      fee = auctionDepositService.getParticipationFee();
    }

    res.json({
      success: true,
      data: {
        participationFee: fee,
        description: 'Phí cọc bắt buộc để tham gia đấu giá (10% starting price nếu có auctionId)'
      }
    });

  } catch (error) {
    console.error('Error getting participation fee:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống'
    });
  }
};
