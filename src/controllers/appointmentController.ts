import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
import Contract from '../models/Contract';
import { User } from '../models/User';
import emailService from '../services/emailService';
import walletService from '../services/walletService';
import depositNotificationService from '../services/depositNotificationService';

// Tạo lịch hẹn sau khi người bán xác nhận cọc
export const createAppointment = async (req: Request, res: Response): Promise<any> => {
  try {
    const { depositRequestId, scheduledDate, location, notes } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    // Kiểm tra deposit request tồn tại và đã được xác nhận
    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu đặt cọc'
      });
    }

    // Kiểm tra quyền tạo lịch hẹn (chỉ người mua hoặc người bán)
    const isBuyer = depositRequest.buyerId === userId;
    const isSeller = depositRequest.sellerId === userId;
    
    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền tạo lịch hẹn cho giao dịch này'
      });
    }
    
    // ✅ Xác định ai tạo appointment (để logic confirm chỉ cần bên còn lại confirm)
    const createdBy = isSeller ? 'SELLER' : 'BUYER';

    // Kiểm tra trạng thái deposit request
    if (depositRequest.status !== 'IN_ESCROW') {
      return res.status(400).json({
        success: false,
        message: 'Yêu cầu đặt cọc chưa được xác nhận hoặc đã hoàn thành'
      });
    }

    // ✅ Kiểm tra đã có lịch hẹn ACTIVE chưa (chỉ chặn nếu đang active)
    // Logic: Cho phép tạo appointment mới nếu appointment cũ đã REJECTED hoặc CANCELLED
    // Chỉ chặn nếu appointment đang active (PENDING, CONFIRMED, RESCHEDULED)
    const existingActiveAppointment = await Appointment.findOne({
      depositRequestId,
      status: { $in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] }
    });

    if (existingActiveAppointment) {
      // Nếu appointment đang active → không cho phép tạo mới
      return res.status(400).json({
        success: false,
        message: 'Đã có lịch hẹn đang hoạt động cho giao dịch này. Vui lòng hủy hoặc từ chối lịch hẹn hiện tại trước khi tạo mới.',
        existingAppointmentId: existingActiveAppointment._id
      });
    }
    
    // ✅ Nếu appointment cũ đã REJECTED hoặc CANCELLED → cho phép tạo appointment mới
    // (theo logic: seller tạo lịch → buyer từ chối → seller tạo lịch lại)

    // ✅ Xóa notification cũ của depositRequest này (nếu tạo lại lịch hẹn)
    // Xóa tất cả notification appointment_created cũ của buyer cho depositRequest này
    try {
      await depositNotificationService.deleteOldNotifications({
        userId: depositRequest.buyerId.toString(),
        type: 'appointment_created',
        depositRequestId: depositRequestId // ✅ Xóa theo depositRequestId
      });
    } catch (error) {
      console.error('Error deleting old appointment notification:', error);
    }

    // Tạo lịch hẹn mặc định 1 tuần sau nếu không có scheduledDate
    let appointmentDate = scheduledDate ? new Date(scheduledDate) : new Date();
    if (!scheduledDate) {
      appointmentDate.setDate(appointmentDate.getDate() + 7);
    }

        const appointment = new Appointment({
      depositRequestId,
      appointmentType: 'NORMAL_DEPOSIT',
      buyerId: depositRequest.buyerId,
      sellerId: depositRequest.sellerId,
      createdBy: createdBy, // ✅ Lưu ai tạo appointment
            scheduledDate: appointmentDate,
      status: 'PENDING',
      type: 'CONTRACT_SIGNING',
      location: location || 'Văn phòng công ty',
      notes: notes || 'Ký kết hợp đồng mua bán xe'
        });

        await appointment.save();

    // Gửi thông báo cho người mua
    try {
      const seller = await User.findById(depositRequest.sellerId);
      const listing = await Listing.findById(depositRequest.listingId);
      
      if (seller) {
        await depositNotificationService.sendAppointmentCreatedNotification(
          depositRequest.buyerId,
          appointment,
          seller,
          listing
        );
      }
    } catch (notificationError) {
      console.error('Error sending appointment notification:', notificationError);
      // Không throw error để không ảnh hưởng đến flow chính
    }

    res.json({
      success: true,
      message: 'Đã tạo lịch hẹn ký hợp đồng thành công',
      appointment: {
        id: appointment._id,
        scheduledDate: appointment.scheduledDate,
        location: appointment.location,
        status: appointment.status,
        type: appointment.type
      }
    });

    } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Xác nhận lịch hẹn
export const confirmAppointment = async (req: Request, res: Response): Promise<any> => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền xác nhận (phải là buyer hoặc seller)
    const buyerId = appointment.buyerId.toString();
    const sellerId = appointment.sellerId.toString();
    const isBuyer = buyerId === userId;
    const isSeller = sellerId === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xác nhận lịch hẹn này'
      });
    }

    // ✅ Kiểm tra trạng thái - cho phép confirm nếu PENDING, CONFIRMED, hoặc RESCHEDULED
    if (appointment.status !== 'PENDING' && appointment.status !== 'CONFIRMED' && appointment.status !== 'RESCHEDULED') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn không thể xác nhận (chỉ có thể xác nhận lịch hẹn đang chờ xác nhận, đã xác nhận, hoặc đã dời lịch)'
      });
    }

    // Kiểm tra đã xác nhận chưa
    if (isBuyer && appointment.buyerConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã xác nhận lịch hẹn này rồi'
      });
    }

    if (isSeller && appointment.sellerConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã xác nhận lịch hẹn này rồi'
      });
    }

    // ✅ Xử lý status sau khi confirm
    // Logic mới: Chỉ cần bên còn lại (so với người tạo) confirm là đủ
    const createdBy = (appointment as any).createdBy || 'SELLER'; // Default là SELLER (backward compatible)
    
    // Xác nhận lịch hẹn
    if (isBuyer) {
      appointment.buyerConfirmed = true;
      appointment.buyerConfirmedAt = new Date();
      // ✅ Nếu seller tạo lịch và buyer confirm → tự động set sellerConfirmed = true
      if (createdBy === 'SELLER') {
        appointment.sellerConfirmed = true;
        appointment.sellerConfirmedAt = new Date();
      }
    }

    if (isSeller) {
      appointment.sellerConfirmed = true;
      appointment.sellerConfirmedAt = new Date();
      // ✅ Nếu buyer tạo lịch và seller confirm → tự động set buyerConfirmed = true
      if (createdBy === 'BUYER') {
        appointment.buyerConfirmed = true;
        appointment.buyerConfirmedAt = new Date();
      }
    }
    
    if (appointment.buyerConfirmed && appointment.sellerConfirmed) {
      // Cả 2 đều đã confirm → chuyển sang CONFIRMED
      appointment.status = 'CONFIRMED';
      appointment.confirmedAt = new Date();
    } else if (createdBy === 'SELLER' && appointment.buyerConfirmed) {
      // ✅ Seller tạo → chỉ cần buyer confirm → CONFIRMED
      appointment.status = 'CONFIRMED';
      appointment.confirmedAt = new Date();
    } else if (createdBy === 'BUYER' && appointment.sellerConfirmed) {
      // ✅ Buyer tạo → chỉ cần seller confirm → CONFIRMED
      appointment.status = 'CONFIRMED';
      appointment.confirmedAt = new Date();
    } else if (appointment.status === 'RESCHEDULED') {
      // ✅ Nếu chưa đủ điều kiện confirm và status là RESCHEDULED → chuyển về PENDING
      appointment.status = 'PENDING';
    }
    // Nếu status đã là PENDING và chưa đủ điều kiện confirm → giữ nguyên PENDING
    
    await appointment.save();
    
    // Gửi email thông báo cho seller và buyer
    try {
      const buyer = await User.findById(appointment.buyerId);
      const seller = await User.findById(appointment.sellerId);
      const depositRequest = await DepositRequest.findById(appointment.depositRequestId).populate('listingId');
      
      if (buyer && seller && depositRequest) {
        const listing = depositRequest.listingId as any;
        
        // Gửi email cho seller
        await emailService.sendAppointmentConfirmedByBuyerNotification(
          appointment.sellerId,
          buyer,
          appointment,
          listing
        );
        
        // Gửi email cho buyer
        await emailService.sendAppointmentConfirmedToBuyerNotification(
          appointment.buyerId,
          seller,
          appointment,
          listing
        );
      }
    } catch (emailError) {
      console.error('Lỗi gửi email thông báo xác nhận:', emailError);
    }

    const responseMessage = appointment.status === 'CONFIRMED'
      ? 'Xác nhận lịch hẹn thành công - Cả hai bên đã xác nhận'
      : 'Xác nhận lịch hẹn thành công - Đang chờ bên còn lại';

    res.json({
      success: true,
      message: responseMessage,
      appointment: {
        id: appointment._id,
        scheduledDate: appointment.scheduledDate,
        status: appointment.status,
        buyerConfirmed: appointment.buyerConfirmed,
        sellerConfirmed: appointment.sellerConfirmed,
        buyerConfirmedAt: appointment.buyerConfirmedAt,
        sellerConfirmedAt: appointment.sellerConfirmedAt,
        confirmedAt: appointment.confirmedAt
      }
    });

    } catch (error) {
    console.error('Error confirming appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Từ chối appointment và tự động dời lịch
export const rejectAppointment = async (req: Request, res: Response): Promise<any> => {
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

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền từ chối (chỉ người mua)
    if (appointment.buyerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người mua mới có quyền từ chối lịch hẹn này'
      });
    }

    // Kiểm tra trạng thái
    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED' || appointment.status === 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: 'Không thể từ chối lịch hẹn đã hoàn thành hoặc đã hủy hoặc đã bị từ chối'
      });
    }

    // ✅ Xóa notification cũ của appointment này
    try {
      await depositNotificationService.deleteOldNotifications({
        userId: appointment.sellerId.toString(),
        type: 'appointment_created',
        appointmentId: appointmentId
      });
    } catch (error) {
      console.error('Error deleting old appointment notification:', error);
    }

    // Đánh dấu appointment đã bị reject
    appointment.status = 'REJECTED' as any;
    appointment.rejectedAt = new Date();
    appointment.notes = reason || appointment.notes;

    await appointment.save();

    // Gửi notification + email thông báo cho seller rằng buyer đã reject và lý do
    try {
      const buyer = await User.findById(appointment.buyerId);
      const depositRequest = await DepositRequest.findById(appointment.depositRequestId);
      const listing = await Listing.findById(depositRequest?.listingId);
      
      if (buyer && depositRequest && listing) {
        // Gửi notification (database + websocket + email)
        await depositNotificationService.sendAppointmentRejectedNotification(
          appointment.sellerId,
          buyer,
          appointment,
          reason || 'Không có lý do cụ thể',
          listing
        );
      }
    } catch (notificationError) {
      console.error('Lỗi gửi thông báo reject:', notificationError);
    }

        res.json({
      success: true,
      message: 'Đã từ chối lịch hẹn. Người bán sẽ nhận được thông báo với lý do và có thể tạo lịch hẹn mới.',
      appointment: {
        id: appointment._id,
        status: appointment.status,
        rejectedAt: appointment.rejectedAt,
        notes: appointment.notes
      }
    });

    } catch (error) {
    console.error('Error rejecting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Dời lịch hẹn (tối đa 1 lần)
export const rescheduleAppointment = async (req: Request, res: Response): Promise<any> => {
    try {
        const { appointmentId } = req.params;
    const { newDate, reason } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền dời lịch (chỉ người mua hoặc người bán)
    if (appointment.buyerId !== userId && appointment.sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền dời lịch hẹn này'
      });
    }

    // Kiểm tra số lần dời lịch
    if (appointment.rescheduledCount >= appointment.maxReschedules) {
      return res.status(400).json({
        success: false,
        message: 'Đã hết số lần dời lịch cho phép'
      });
    }

    // Kiểm tra trạng thái
    if (appointment.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Không thể dời lịch hẹn đã hoàn thành'
      });
    }

    // ✅ Cho phép reschedule appointment bị REJECTED hoặc CANCELLED
    // Dời lịch (có thể từ REJECTED/CANCELLED → RESCHEDULED)
    const newScheduledDate = new Date(newDate || new Date());
    // Không tự động +7 ngày nếu đã có newDate được truyền vào
    if (!newDate) {
      newScheduledDate.setDate(newScheduledDate.getDate() + 7);
    }

    appointment.scheduledDate = newScheduledDate;
    appointment.status = 'RESCHEDULED';
    appointment.rescheduledCount += 1;
    appointment.notes = reason || appointment.notes;
    
    // ✅ Reset confirmation flags khi reschedule (cả 2 bên cần confirm lại)
    appointment.buyerConfirmed = false;
    appointment.sellerConfirmed = false;
    appointment.buyerConfirmedAt = undefined;
    appointment.sellerConfirmedAt = undefined;
    appointment.confirmedAt = undefined;

        await appointment.save();

    // TODO: Gửi thông báo dời lịch cho cả 2 bên
    // await notificationService.sendRescheduleNotification(
    //   appointment.buyerId,
    //   appointment.sellerId,
    //   appointment
    // );

    res.json({
      success: true,
      message: 'Dời lịch hẹn thành công',
      appointment: {
        id: appointment._id,
        scheduledDate: appointment.scheduledDate,
        status: appointment.status,
        rescheduledCount: appointment.rescheduledCount
      }
    });

  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Hủy lịch hẹn
export const cancelAppointment = async (req: Request, res: Response): Promise<any> => {
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

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền hủy lịch (chỉ người mua hoặc người bán)
    if (appointment.buyerId !== userId && appointment.sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy lịch hẹn này'
      });
    }

    // Kiểm tra trạng thái
    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn đã hoàn thành hoặc đã hủy'
      });
    }

    // Lấy thông tin deposit request
    const depositRequest = await DepositRequest.findById(appointment.depositRequestId);
    if (!depositRequest) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin đặt cọc'
      });
    }


    // ✅ Nếu tiền đã vào escrow -> hoàn tiền và hủy giao dịch (dù buyer hay seller hủy)
    const isBuyer = appointment.buyerId.toString() === userId;
    let isTransactionCancelled = false;
    
    if (depositRequest.status === 'IN_ESCROW') {
      // Hoàn tiền từ escrow về ví buyer (100%)
      await walletService.refundFromEscrow((depositRequest._id as any).toString());

      // Cập nhật trạng thái listing về Published để có thể bán lại
      const listing = await Listing.findById(depositRequest.listingId);
      if (listing && listing.status === 'InTransaction') {
        listing.status = 'Published';
        await listing.save();
      }

      // Cập nhật deposit request status
      depositRequest.status = 'CANCELLED';
      await depositRequest.save();
      isTransactionCancelled = true;
    }
    // ✅ Nếu tiền chưa vào escrow (status = 'SELLER_CONFIRMED' hoặc khác) -> chỉ hủy appointment
    // → isTransactionCancelled = false → appointment_cancelled

    // Cập nhật appointment status
    appointment.status = 'CANCELLED';
    appointment.cancelledAt = new Date();
    appointment.notes = reason || appointment.notes;
    
    await appointment.save();

    // Gửi thông báo hủy lịch cho cả 2 bên (notification + email)
    try {
      const buyer = await User.findById(appointment.buyerId);
      const seller = await User.findById(appointment.sellerId);
      const listing = await Listing.findById(depositRequest.listingId);
      
      if (buyer && seller && listing) {
        await depositNotificationService.sendAppointmentCancelledNotification(
          appointment.buyerId.toString(),
          appointment.sellerId.toString(),
          appointment,
          reason || 'Không nêu lý do',
          listing,
          depositRequest,
          isTransactionCancelled
        );
      }
    } catch (notificationError) {
      console.error('Error sending cancellation notification:', notificationError);
      // Không throw error để không ảnh hưởng đến flow chính
    }

    res.json({
      success: true,
      message: isTransactionCancelled
        ? 'Đã hủy giao dịch thành công, tiền đã hoàn về ví của bạn'
        : 'Hủy lịch hẹn thành công',
      appointment: {
        id: appointment._id,
        status: appointment.status,
        cancelledAt: appointment.cancelledAt
      },
      refunded: isTransactionCancelled
    });

    } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy danh sách lịch hẹn của user
export const getUserAppointments = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }
    const { status, type, page = 1, limit = 10 } = req.query;

    const filter: any = {
      $or: [{ buyerId: userId }, { sellerId: userId }]
    };

    if (status) {
      filter.status = status;
    }

    if (type) {
      filter.type = type;
    }

    const appointments = await Appointment.find(filter)
      .populate('depositRequestId', 'depositAmount status')
      .populate('auctionId', 'startingPrice winningBid status')
      .populate('buyerId', 'fullName email phone avatar')
      .populate('sellerId', 'fullName email phone avatar')
      .sort({ scheduledDate: -1 })
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
    console.error('Error getting user appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy chi tiết lịch hẹn
export const getAppointmentDetails = async (req: Request, res: Response): Promise<any> => {
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
      .populate('sellerId', 'name email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền xem (chỉ người mua hoặc người bán)
    const buyerId = typeof appointment.buyerId === 'string' ? appointment.buyerId : (appointment.buyerId as any)._id.toString();
    const sellerId = typeof appointment.sellerId === 'string' ? appointment.sellerId : (appointment.sellerId as any)._id.toString();
    
    if (buyerId !== userId && sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem lịch hẹn này'
      });
    }

    res.json({
      success: true,
      data: appointment
    });

    } catch (error) {
    console.error('Error getting appointment details:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy danh sách appointment cho staff
export const getStaffAppointments = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    // ✅ Kiểm tra quyền staff hoặc admin
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ nhân viên và admin mới có quyền truy cập'
      });
    }

    const { status, search } = req.query;

    // Filter appointments
    const filter: any = {};
    
    // ✅ Parse status nếu là comma-separated string (từ query params)
    if (status) {
      const statusStr = status as string;
      // Nếu status chứa dấu phẩy, split thành array
      if (statusStr.includes(',')) {
        const statusArray = statusStr.split(',').map(s => s.trim()).filter(s => s);
        filter.status = { $in: statusArray };
      } else {
        filter.status = statusStr.trim();
      }
    } else {

      filter.status = { $in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] };
    }

  
    let searchTerm = search ? (search as string).trim() : null;

   
    const allAppointments = await Appointment.find(filter)
      .populate('depositRequestId', 'depositAmount status listingId')
      .populate('buyerId', 'fullName email phone')
      .populate('sellerId', 'fullName email phone')
      .populate({
        path: 'depositRequestId',
        populate: {
          path: 'listingId',
          select: 'title brand make model year priceListed licensePlate engineDisplacementCc vehicleType paintColor engineNumber chassisNumber otherFeatures ' // ✅ Thêm các trường đặc điểm xe
        }
      })
      .populate({
        path: 'auctionId',
        select: 'startingPrice winningBid status',
        populate: {
          path: 'listingId',
          select: 'title brand make model year priceListed licensePlate engineDisplacementCc vehicleType paintColor engineNumber chassisNumber otherFeatures'
        }
      })
      .sort({ scheduledDate: 1 }); // Sắp xếp theo ngày hẹn gần nhất

    // ✅ Filter theo search term sau khi populate (nếu có)
    let filteredAppointments = allAppointments;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredAppointments = allAppointments.filter(appointment => {
        const buyer = appointment.buyerId as any;
        const seller = appointment.sellerId as any;
        const appointmentId = appointment._id?.toString() || '';
        
        return (
          appointmentId.toLowerCase().includes(searchLower) ||
          buyer?.fullName?.toLowerCase().includes(searchLower) ||
          buyer?.email?.toLowerCase().includes(searchLower) ||
          buyer?.phone?.includes(searchTerm) ||
          seller?.fullName?.toLowerCase().includes(searchLower) ||
          seller?.email?.toLowerCase().includes(searchLower) ||
          seller?.phone?.includes(searchTerm)
        );
      });
    }

    // ✅ Lấy contract photos cho tất cả appointments (để tránh N+1 query)
    const appointmentIds = filteredAppointments.map((a: any) => {
      const id = (a as any)._id;
      return id ? id.toString() : '';
    }).filter(id => id);
    const contracts = await Contract.find({ appointmentId: { $in: appointmentIds } })
      .select('appointmentId contractPhotos status _id');
    const contractMap = new Map<string, any>();
    contracts.forEach((contract: any) => {
      contractMap.set(contract.appointmentId.toString(), contract);
    });

    // ✅ Format data cho staff (trả về tất cả, không phân trang)
    const formattedAppointments = filteredAppointments.map((appointment: any) => {
      const appointmentId = (appointment as any)._id?.toString() || '';
      const contract = contractMap.get(appointmentId);
      
      // Xác định nguồn dữ liệu: auction hoặc deposit
      const isAuction = appointment.appointmentType === 'AUCTION' && appointment.auctionId;
      let listing, depositAmount, depositStatus, vehiclePrice;
      
      if (isAuction) {
        // Từ auction
        const auction = appointment.auctionId as any;
        listing = auction?.listingId;
        depositAmount = 1000000; // Phí tham gia đấu giá
        depositStatus = 'N/A';
        vehiclePrice = auction?.winningBid?.price || auction?.startingPrice || 0;
      } else {
        // Từ deposit thông thường
        const depositRequest = appointment.depositRequestId as any;
        listing = depositRequest?.listingId;
        depositAmount = depositRequest?.depositAmount || 0;
        depositStatus = depositRequest?.status || 'N/A';
        vehiclePrice = listing?.priceListed || 0;
      }
      
      return {
      id: appointment._id,
      appointmentId: appointment._id,
      scheduledDate: appointment.scheduledDate,
      status: appointment.status,
      location: appointment.location,
      type: appointment.type,
      rescheduledCount: appointment.rescheduledCount,
      maxReschedules: appointment.maxReschedules,
      
      // Thông tin người mua
      buyer: {
        id: (appointment.buyerId as any)?._id || appointment.buyerId,
        name: (appointment.buyerId as any)?.fullName || 'N/A',
        email: (appointment.buyerId as any)?.email || 'N/A',
        phone: (appointment.buyerId as any)?.phone || 'N/A'
      },
      
      // Thông tin người bán
      seller: {
        id: (appointment.sellerId as any)?._id || appointment.sellerId,
        name: (appointment.sellerId as any)?.fullName || 'N/A',
        email: (appointment.sellerId as any)?.email || 'N/A',
        phone: (appointment.sellerId as any)?.phone || 'N/A'
      },
      
      // Thông tin xe
      vehicle: {
        title: listing?.title || 'N/A',
        brand: listing?.brand || 'N/A',
        make: listing?.make || 'N/A',
        model: listing?.model || 'N/A',
        year: listing?.year || 'N/A',
        price: vehiclePrice,
        // ✅ Đặc điểm xe (theo form hợp đồng)
        licensePlate: listing?.licensePlate || 'N/A', // Biển số
        engineDisplacementCc: listing?.engineDisplacementCc || 0, // Dung tích xi lanh
        vehicleType: listing?.vehicleType || 'N/A', // Loại xe
        paintColor: listing?.paintColor || 'N/A', // Màu sơn
        engineNumber: listing?.engineNumber || 'N/A', // Số máy
        chassisNumber: listing?.chassisNumber || 'N/A', // Số khung
        otherFeatures: listing?.otherFeatures || 'N/A' // Các đặc điểm khác
      },
      
      // Thông tin giao dịch
      transaction: {
        depositAmount: depositAmount,
        depositStatus: depositStatus,
        vehiclePrice: vehiclePrice,
        remainingAmount: vehiclePrice - depositAmount,
        depositPercentage: vehiclePrice 
          ? (depositAmount / vehiclePrice * 100).toFixed(2)
          : '0.00'
      },
      
      // Thông tin xác nhận
      confirmation: {
        buyerConfirmed: appointment.buyerConfirmed,
        sellerConfirmed: appointment.sellerConfirmed,
        confirmedAt: appointment.confirmedAt
      },
      
      // ✅ Ảnh hợp đồng (từ Contract model)
      contractPhotos: contract?.contractPhotos || [],
      contractStatus: contract?.status || null,
      contractId: contract?._id || null,
      
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt
      };
    });

    res.json({
      success: true,
      message: 'Lấy danh sách appointment thành công',
      data: formattedAppointments,
      total: formattedAppointments.length, // ✅ Tổng số appointments sau khi filter
      filters: {
        status: status || 'CONFIRMED,COMPLETED,CANCELLED',
        search: searchTerm || ''
      }
    });

  } catch (error) {
    console.error('Error getting staff appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Tạo lịch hẹn từ auction (cho người thắng cuộc)
export const createAppointmentFromAuction = async (req: Request, res: Response): Promise<any> => {
  try {
    const { auctionId } = req.params;
    const { scheduledDate, location, notes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const appointmentService = (await import('../services/appointmentService')).default;

    const appointment = await appointmentService.createAppointmentFromAuction({
      auctionId,
      userId,
      scheduledDate,
      location,
      notes
    });

    res.status(200).json({
      success: true,
      message: 'Đã tạo lịch hẹn ký hợp đồng từ phiên đấu giá',
      appointment
    });

  } catch (error) {
    console.error('Error creating appointment from auction:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi tạo lịch hẹn'
    });
  }
};

// Lấy danh sách lịch hẹn từ các phiên đấu giá
export const getAuctionAppointments = async (req: Request, res: Response): Promise<any> => {
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
      appointmentType: 'AUCTION',
      $or: [{ buyerId: userId }, { sellerId: userId }]
    };

    if (status) {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate('auctionId', 'startingPrice winningBid status startAt endAt')
      .populate({
        path: 'auctionId',
        populate: {
          path: 'listingId',
          select: 'make model year photos priceListed batteryCapacity range'
        }
      })
      .populate('buyerId', 'fullName email phone avatar')
      .populate('sellerId', 'fullName email phone avatar')
      .sort({ scheduledDate: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await Appointment.countDocuments(filter);

    res.json({
      success: true,
      message: 'Lấy danh sách lịch hẹn đấu giá thành công',
      data: appointments,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Error getting auction appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
