import { Request, Response } from 'express';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
import { User } from '../models/User';
import walletService from '../services/walletService';
import depositNotificationService from '../services/depositNotificationService';

// Tạo yêu cầu đặt cọc
export const createDepositRequest = async (req: Request, res: Response) => {
  try {
    const { listingId, depositAmount } = req.body;
    const buyerId = req.user?.id;
    
    // Kiểm tra listing tồn tại
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin đăng'
      });
    }

    // Kiểm tra không được đặt cọc chính xe của mình
    if (listing.sellerId.toString() === buyerId) {
      return res.status(400).json({
        success: false,
        message: 'Không thể đặt cọc xe của chính mình'
      });
    }

    // Kiểm tra xe còn bán không
    if (listing.status !== 'Published') {
      return res.status(400).json({
        success: false,
        message: 'Xe đã bán'
      });
    }

    // Kiểm tra đã có yêu cầu đặt cọc chưa
    const existingRequest = await DepositRequest.findOne({
      listingId,
      buyerId,
      status: { $in: ['PENDING_SELLER_CONFIRMATION', 'SELLER_CONFIRMED', 'IN_ESCROW'] }
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đặt cọc xe này rồi'
      });
    }

    // Kiểm tra số dư ví người mua
    const buyerWallet = await walletService.getWallet(buyerId!);
    
    if (buyerWallet.balance < depositAmount) {
      // Không đủ tiền -> Tạo link nạp tiền qua VNPay
      const vnpayUrl = await walletService.createDepositUrl(
        buyerId!.toString(),
        depositAmount,
        `Nạp tiền đặt cọc mua xe ${(listing as any).title || 'Xe'}`,
        req
      );

      return res.json({
        success: false,
        message: 'Số dư không đủ để đặt cọc',
        vnpayUrl: vnpayUrl,
        requiredAmount: depositAmount,
        currentBalance: buyerWallet.balance
      });
    }

    // Đủ tiền -> Đóng băng tiền và tạo yêu cầu đặt cọc
    await walletService.freezeAmount(
      buyerId!, 
      depositAmount, 
      `Đặt cọc mua xe ${(listing as any).title || 'Xe'}`
    );

    const depositRequest = new DepositRequest({
      listingId,
      buyerId,
      sellerId: listing.sellerId,
      depositAmount,
      status: 'PENDING_SELLER_CONFIRMATION'
    });

    await depositRequest.save();

    // Gửi thông báo cho người bán
    try {
      const buyer = await User.findById(buyerId);
      if (buyer) {
        await depositNotificationService.sendDepositRequestNotification(
          listing.sellerId.toString(), 
          depositRequest, 
          buyer,
          listing  // Thêm thông tin listing
        );
      }
    } catch (notificationError) {
      console.error('Error sending deposit notification:', notificationError);
      // Không throw error để không ảnh hưởng đến flow chính
    }

    res.json({
      success: true,
      message: 'Đặt cọc thành công, chờ người bán xác nhận',
      depositRequest: {
        id: depositRequest._id,
        amount: depositRequest.depositAmount,
        status: depositRequest.status,
        expiresAt: depositRequest.expiresAt
      }
    });

  } catch (error) {
    console.error('Error creating deposit request:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Người bán xác nhận hoặc từ chối cọc
export const sellerConfirmDeposit = async (req: Request, res: Response) => {
  try {
    const { depositRequestId } = req.params; // Lấy từ URL path parameter
    const { action } = req.body; // 'CONFIRM' hoặc 'REJECT'
    const sellerId = req.user?.id;
    
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const depositRequest = await DepositRequest.findById(depositRequestId);
    
    if (!depositRequest) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu đặt cọc'
      });
    }

    // Kiểm tra quyền sở hữu
    if (depositRequest.sellerId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xác nhận yêu cầu này'
      });
    }

    // Kiểm tra trạng thái
    if (depositRequest.status !== 'PENDING_SELLER_CONFIRMATION') {
      return res.status(400).json({
        success: false,
        message: 'Yêu cầu đặt cọc đã được xử lý'
      });
    }
    
    
    if (action === 'CONFIRM') {
      // Xác nhận cọc -> Chuyển tiền vào Escrow và tạo appointment
      const result = await walletService.transferToEscrow(depositRequestId);

      // Gửi thông báo cho người mua
      try {
        const seller = await User.findById(sellerId);
        const listing = await Listing.findById(depositRequest.listingId);
        if (seller) {
          await depositNotificationService.sendDepositConfirmationNotification(
            depositRequest.buyerId, 
            depositRequest,
            seller,
            'accept',
            listing  // Thêm thông tin listing
          );
        }
      } catch (notificationError) {
        console.error('Error sending deposit confirmation notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'Xác nhận cọc thành công, tiền đã chuyển vào Escrow và lịch hẹn đã được tạo',
        appointment: {
          id: result.appointment._id,
          scheduledDate: result.appointment.scheduledDate,
          location: result.appointment.location,
          status: result.appointment.status,
          type: result.appointment.type
        }
      });

    } else if (action === 'REJECT') {
      // Từ chối cọc -> Hoàn tiền từ frozen về ví người mua
      await walletService.unfreezeAmount(
        depositRequest.buyerId,
        depositRequest.depositAmount,
        'Seller từ chối đặt cọc'
      );

      // Cập nhật trạng thái deposit request
      depositRequest.status = 'SELLER_CANCELLED';
      await depositRequest.save();

      // Gửi thông báo cho người mua
      try {
        const seller = await User.findById(sellerId);
        const listing = await Listing.findById(depositRequest.listingId);
        if (seller) {
          await depositNotificationService.sendDepositConfirmationNotification(
            depositRequest.buyerId,
            depositRequest,
            seller,
            'reject',
            listing  // Thêm thông tin listing
          );
        }
      } catch (notificationError) {
        console.error('Error sending deposit rejection notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'Đã từ chối cọc, tiền đã hoàn về ví người mua'
      });

    } else {
      return res.status(400).json({
        success: false,
        message: 'Hành động không hợp lệ'
      });
    }

  } catch (error) {
    console.error('Error confirming deposit:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy danh sách yêu cầu đặt cọc của người mua
export const getBuyerDepositRequests = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user?.id;
    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }
    const { status, page = 1, limit = 10 } = req.query;

    const filter: any = { buyerId };
    if (status) {
      filter.status = status;
    }

    const depositRequests = await DepositRequest.find(filter)
      .populate('listingId', 'title price images')
      .populate('sellerId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await DepositRequest.countDocuments(filter);

    res.json({
      success: true,
      data: depositRequests,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Error getting buyer deposit requests:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy danh sách yêu cầu đặt cọc của người bán
export const getSellerDepositRequests = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }
    const { status, page = 1, limit = 10 } = req.query;

    const filter: any = { sellerId };
    if (status) {
      filter.status = status;
    }

    const depositRequests = await DepositRequest.find(filter)
      .populate('listingId', 'title price images')
      .populate('buyerId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await DepositRequest.countDocuments(filter);

    res.json({
      success: true,
      data: depositRequests,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Error getting seller deposit requests:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Hủy yêu cầu đặt cọc (chỉ người mua)
export const cancelDepositRequest = async (req: Request, res: Response) => {
  try {
    const { depositRequestId } = req.params;
    const buyerId = req.user?.id;
    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu đặt cọc'
      });
    }

    // Kiểm tra quyền sở hữu
    if (depositRequest.buyerId !== buyerId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy yêu cầu này'
      });
    }

    // Kiểm tra trạng thái
    if (depositRequest.status !== 'PENDING_SELLER_CONFIRMATION') {
      return res.status(400).json({
        success: false,
        message: 'Không thể hủy yêu cầu đã được xử lý'
      });
    }

    // Hoàn tiền về ví người mua
    await walletService.unfreezeAmount(
      buyerId,
      depositRequest.depositAmount,
      'Hủy đặt cọc'
    );

    // Cập nhật trạng thái
    depositRequest.status = 'CANCELLED';
    await depositRequest.save();

    res.json({
      success: true,
      message: 'Hủy đặt cọc thành công, tiền đã hoàn về ví'
    });

  } catch (error) {
    console.error('Error cancelling deposit request:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
