import { Request, Response } from 'express';
import Contract from '../models/Contract';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
import EscrowAccount from '../models/EscrowAccount';
import walletService from '../services/walletService';
// [TRANSACTION_HISTORY_FEATURE] - Import service mới cho tính năng lịch sử giao dịch
// Để xóa: Xóa dòng import này và xóa file transactionHistoryService.ts
import { transactionHistoryService } from '../services/transactionHistoryService';

// Nhân viên xác nhận giao dịch hoàn thành
export const confirmTransaction = async (req: Request, res: Response) => {
  try {
    const { appointmentId, contractPhotos } = req.body;
    const staffId = req.user?.id;
    if (!staffId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    // Kiểm tra appointment tồn tại
    const appointment = await Appointment.findById(appointmentId)
      .populate('depositRequestId')
      .populate('buyerId', 'name email')
      .populate('sellerId', 'name email');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra trạng thái appointment
    if (appointment.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn chưa được xác nhận'
      });
    }

    // Kiểm tra hợp đồng đã ký chưa
    const contract = await Contract.findOne({ appointmentId });
    if (!contract || contract.status !== 'SIGNED') {
      return res.status(400).json({
        success: false,
        message: 'Hợp đồng chưa được ký đầy đủ'
      });
    }

    // Lưu ảnh hợp đồng (nếu có)
    if (contractPhotos && contractPhotos.length > 0) {
      // TODO: Upload ảnh lên storage
      // const uploadedPhotos = await fileStorageService.uploadMultiple(contractPhotos);
      // contract.contractPhotos = uploadedPhotos;
    }

    // Chuyển tiền từ Escrow về hệ thống
    await walletService.completeTransaction((appointment.depositRequestId as any)._id.toString());

    // Cập nhật trạng thái hợp đồng
    contract.status = 'COMPLETED';
    contract.completedAt = new Date();
    await contract.save();

    // Cập nhật trạng thái appointment
    appointment.status = 'COMPLETED';
    appointment.completedAt = new Date();
    await appointment.save();

    // TODO: Gửi thông báo hoàn thành cho cả 2 bên
    // await notificationService.sendTransactionCompletedNotification(
    //   appointment.buyerId._id,
    //   appointment.sellerId._id,
    //   appointment
    // );

    res.json({
      success: true,
      message: 'Xác nhận giao dịch hoàn thành thành công',
      transaction: {
        appointmentId: appointment._id,
        contractId: contract._id,
        completedAt: appointment.completedAt,
        depositAmount: (appointment.depositRequestId as any).depositAmount
      }
    });

  } catch (error) {
    console.error('Error confirming transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy danh sách giao dịch cần xác nhận (cho nhân viên)
export const getPendingTransactions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Lấy các appointment đã xác nhận nhưng chưa hoàn thành
    const appointments = await Appointment.find({
      status: 'CONFIRMED',
      scheduledDate: { $lte: new Date() } // Đã đến ngày hẹn
    })
      .populate('depositRequestId', 'depositAmount status')
      .populate('buyerId', 'name email phone')
      .populate('sellerId', 'name email phone')
      .populate('listingId', 'title brand model year price')
      .sort({ scheduledDate: 1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Appointment.countDocuments({
      status: 'CONFIRMED',
      scheduledDate: { $lte: new Date() }
    });

    res.json({
      success: true,
      data: appointments,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Error getting pending transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// [TRANSACTION_HISTORY_FEATURE] - User xem chi tiết giao dịch của mình
// User chỉ xem được chi tiết giao dịch mà họ là buyer hoặc seller
export const getTransactionDetails = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    // Lấy userId từ JWT token (đã được set bởi authenticate middleware)
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập hoặc token không hợp lệ'
      });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('buyerId', 'fullName email phone')
      .populate('sellerId', 'fullName email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giao dịch'
      });
    }

    // Kiểm tra quyền xem: User chỉ xem được giao dịch của mình (buyer hoặc seller)
    const buyerId = (appointment.buyerId as any)?._id?.toString() || (appointment.buyerId as any)?.toString();
    const sellerId = (appointment.sellerId as any)?._id?.toString() || (appointment.sellerId as any)?.toString();
    const userIdStr = userId.toString();
    
    const isBuyer = buyerId === userIdStr;
    const isSeller = sellerId === userIdStr;
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';

    // User chỉ xem được giao dịch của mình, admin/staff xem được tất cả
    if (!isBuyer && !isSeller && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem giao dịch này. Chỉ có thể xem giao dịch của mình.'
      });
    }

    // Lấy thông tin hợp đồng và listing
    const transaction =
      await transactionHistoryService.getTransactionById(appointmentId, {
        currentUserId: userIdStr,
        adminView: isStaff,
      });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giao dịch',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });

  } catch (error) {
    console.error('Error getting transaction details:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// [TRANSACTION_HISTORY_FEATURE] - User xem giao dịch của mình
// userId được lấy từ JWT token qua middleware authenticate
// Flow: Client gửi JWT token trong header Authorization → authenticate middleware decode token → set req.user.id → controller lấy userId từ req.user.id
export const getUserTransactionHistory = async (req: Request, res: Response) => {
  try {
    // Lấy userId từ JWT token (đã được set bởi authenticate middleware)
    // JWT token chứa userId, middleware authenticate decode và set vào req.user.id
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập hoặc token không hợp lệ'
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const result = await transactionHistoryService.getUserTransactionHistory(
      userId,
      {
        status: status as string | undefined,
        page: Number(page),
        limit: Number(limit),
      }
    );

    res.json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Error getting user transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// [TRANSACTION_HISTORY_FEATURE] - Admin xem tất cả giao dịch của các user
export const getAdminTransactionHistory = async (req: Request, res: Response) => {
  try {
    // Kiểm tra quyền admin
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'staff';
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin/staff mới có quyền xem lịch sử giao dịch'
      });
    }

    const { status, page = 1, limit = 20 } = req.query;

    const result = await transactionHistoryService.getAdminTransactionHistory({
      status: status as string | undefined,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Error getting admin transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// [TRANSACTION_HISTORY_FEATURE] - Lấy tất cả giao dịch trong hệ thống (không filter gì cả)
export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    // Kiểm tra quyền admin/staff
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'staff';
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin/staff mới có quyền xem tất cả giao dịch'
      });
    }

    const { page = 1, limit = 20 } = req.query;

    const result = await transactionHistoryService.getAllTransactions({
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Error getting all transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};


// Hủy giao dịch (chỉ trong trường hợp đặc biệt)
export const cancelTransaction = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('depositRequestId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền hủy (chỉ nhân viên hoặc admin)
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy giao dịch'
      });
    }

    // Kiểm tra trạng thái
    if (appointment.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Không thể hủy giao dịch đã hoàn thành'
      });
    }

    // Hoàn tiền về ví người mua
    await walletService.refundFromEscrow((appointment.depositRequestId as any)._id.toString());

    // Cập nhật trạng thái
    appointment.status = 'CANCELLED';
    appointment.cancelledAt = new Date();
    appointment.notes = reason || appointment.notes;
    await appointment.save();

    // Cập nhật hợp đồng nếu có
    const contract = await Contract.findOne({ appointmentId });
    if (contract) {
      contract.status = 'CANCELLED';
      await contract.save();
    }

    // TODO: Gửi thông báo hủy giao dịch
    // await notificationService.sendTransactionCancelledNotification(
    //   appointment.buyerId,
    //   appointment.sellerId,
    //   appointment
    // );

    res.json({
      success: true,
      message: 'Hủy giao dịch thành công, tiền đã hoàn về ví người mua',
      transaction: {
        appointmentId: appointment._id,
        status: appointment.status,
        cancelledAt: appointment.cancelledAt
      }
    });

  } catch (error) {
    console.error('Error cancelling transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
