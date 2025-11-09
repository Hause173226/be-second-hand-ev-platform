import { Request, Response } from 'express';
import Contract from '../models/Contract';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import EscrowAccount from '../models/EscrowAccount';
import walletService from '../services/walletService';

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

// Lấy chi tiết giao dịch
export const getTransactionDetails = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('depositRequestId')
      .populate('buyerId', 'name email phone')
      .populate('sellerId', 'name email phone')
      .populate('listingId', 'title brand model year price images');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền xem (người mua, người bán, hoặc nhân viên)
    const isBuyer = (appointment.buyerId as any)._id.toString() === userId;
    const isSeller = (appointment.sellerId as any)._id.toString() === userId;
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';

    if (!isBuyer && !isSeller && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem giao dịch này'
      });
    }

    // Lấy thông tin hợp đồng
    const contract = await Contract.findOne({ appointmentId });

    res.json({
      success: true,
      data: {
        appointment,
        contract,
        depositRequest: appointment.depositRequestId,
        listing: (appointment as any).listingId
      }
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

// Lấy lịch sử giao dịch của user
export const getUserTransactionHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }
    const { status, page = 1, limit = 10 } = req.query;

    const filter: any = {
      $or: [{ buyerId: userId }, { sellerId: userId }]
    };

    if (status) {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate('depositRequestId', 'depositAmount status')
      .populate('buyerId', 'name email')
      .populate('sellerId', 'name email')
      .populate('listingId', 'title brand model year price')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Appointment.countDocuments(filter);

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
    console.error('Error getting user transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy lịch sử giao dịch cho admin (tất cả giao dịch)
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

    const { status, buyerId, sellerId, page = 1, limit = 20, startDate, endDate } = req.query;

    const filter: any = {};

    // Filter theo status
    if (status) {
      filter.status = status;
    }

    // Filter theo buyer
    if (buyerId) {
      filter.buyerId = buyerId;
    }

    // Filter theo seller
    if (sellerId) {
      filter.sellerId = sellerId;
    }

    // Filter theo thời gian
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate as string);
      }
    }

    const appointments = await Appointment.find(filter)
      .populate('depositRequestId', 'depositAmount status')
      .populate('buyerId', 'fullName email phone')
      .populate('sellerId', 'fullName email phone')
      .populate('listingId', 'title make model year priceListed')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Appointment.countDocuments(filter);

    // Lấy thông tin contract cho mỗi appointment
    const appointmentsWithContract = await Promise.all(
      appointments.map(async (appointment) => {
        const contract = await Contract.findOne({ appointmentId: appointment._id });
        return {
          ...appointment.toObject(),
          contract: contract || null
        };
      })
    );

    res.json({
      success: true,
      data: appointmentsWithContract,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
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
