import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
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
    if (depositRequest.buyerId !== userId && depositRequest.sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền tạo lịch hẹn cho giao dịch này'
      });
    }

    // Kiểm tra trạng thái deposit request
    if (depositRequest.status !== 'IN_ESCROW') {
      return res.status(400).json({
        success: false,
        message: 'Yêu cầu đặt cọc chưa được xác nhận hoặc đã hoàn thành'
      });
    }

    // Kiểm tra đã có lịch hẹn chưa
    const existingAppointment = await Appointment.findOne({
      depositRequestId,
      status: { $in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'Đã có lịch hẹn cho giao dịch này'
      });
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

    // Kiểm tra trạng thái
    if (appointment.status !== 'PENDING' && appointment.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn không thể xác nhận'
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

    // Xác nhận lịch hẹn
    if (isBuyer) {
      appointment.buyerConfirmed = true;
      appointment.buyerConfirmedAt = new Date();
    }

    if (isSeller) {
      appointment.sellerConfirmed = true;
      appointment.sellerConfirmedAt = new Date();
    }

    // Nếu cả 2 đều đã confirm → chuyển sang CONFIRMED
    if (appointment.buyerConfirmed && appointment.sellerConfirmed) {
      appointment.status = 'CONFIRMED';
      appointment.confirmedAt = new Date();
    }
    
    await appointment.save();
    
    // Gửi email thông báo
    try {
      const buyer = await User.findById(appointment.buyerId);
      const seller = await User.findById(appointment.sellerId);
      
      if (buyer && seller) {
        if (isBuyer) {
          // Thông báo cho seller rằng buyer đã xác nhận
          await emailService.sendAppointmentConfirmedByBuyerNotification(
            appointment.sellerId,
            buyer,
            appointment,
            null
          );
        } else if (isSeller) {
          // Thông báo cho buyer rằng seller đã xác nhận
          await emailService.sendAppointmentConfirmedByBuyerNotification(
            appointment.buyerId,
            seller,
            appointment,
            null
          );
        }
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
    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Không thể dời lịch hẹn đã hoàn thành hoặc đã hủy'
      });
    }

    // Dời lịch 1 tuần nữa
    const newScheduledDate = new Date(newDate || new Date());
    newScheduledDate.setDate(newScheduledDate.getDate() + 7);

    appointment.scheduledDate = newScheduledDate;
    appointment.status = 'RESCHEDULED';
    appointment.rescheduledCount += 1;
    appointment.notes = reason || appointment.notes;

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

    appointment.status = 'CANCELLED';
    appointment.cancelledAt = new Date();
    appointment.notes = reason || appointment.notes;
    
    await appointment.save();

    // TODO: Gửi thông báo hủy lịch cho cả 2 bên
    // await notificationService.sendCancelAppointmentNotification(
    //   appointment.buyerId,
    //   appointment.sellerId,
    //   appointment
    // );

    res.json({
      success: true,
      message: 'Hủy lịch hẹn thành công',
      appointment: {
        id: appointment._id,
        status: appointment.status,
        cancelledAt: appointment.cancelledAt
      }
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

    // Kiểm tra quyền staff
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ nhân viên mới có quyền truy cập'
      });
    }

    const { status, page = 1, limit = 10, search } = req.query;

    // Filter appointments
    const filter: any = {};
    
    // Lấy appointment theo filter hoặc default (CONFIRMED, PENDING, RESCHEDULED, COMPLETED)
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ['CONFIRMED', 'PENDING', 'RESCHEDULED', 'COMPLETED'] };
    }

    // Search theo tên người mua/bán hoặc ID
    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      filter.$or = [
        { _id: { $regex: searchRegex } },
        { 'buyerId': { $regex: searchRegex } },
        { 'sellerId': { $regex: searchRegex } }
      ];
    }

    const appointments = await Appointment.find(filter)
      .populate('depositRequestId', 'depositAmount status listingId')
      .populate('buyerId', 'fullName email phone')
      .populate('sellerId', 'fullName email phone')
      .populate({
        path: 'depositRequestId',
        populate: {
          path: 'listingId',
          select: 'title brand make model year price '
        }
      })
      .sort({ scheduledDate: 1 }) // Sắp xếp theo ngày hẹn gần nhất
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Appointment.countDocuments(filter);

    // Format data cho staff
    const formattedAppointments = appointments.map(appointment => ({
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
        id: appointment.buyerId._id,
        name: appointment.buyerId.fullName,
        email: appointment.buyerId.email,
        phone: appointment.buyerId.phone
      },
      
      // Thông tin người bán
      seller: {
        id: appointment.sellerId._id,
        name: appointment.sellerId.fullName,
        email: appointment.sellerId.email,
        phone: appointment.sellerId.phone
      },
      
      // Thông tin xe
      vehicle: {
        title: (appointment.depositRequestId as any).listingId?.title || 'N/A',
        brand: (appointment.depositRequestId as any).listingId?.brand || 'N/A',
        make: (appointment.depositRequestId as any).listingId?.make || 'N/A',
        model: (appointment.depositRequestId as any).listingId?.model || 'N/A',
        year: (appointment.depositRequestId as any).listingId?.year || 'N/A',
        price: (appointment.depositRequestId as any).listingId?.price || 0
      },
      
      // Thông tin giao dịch
      transaction: {
        depositAmount: appointment.depositRequestId.depositAmount,
        depositStatus: appointment.depositRequestId.status
      },
      
      // Thông tin xác nhận
      confirmation: {
        buyerConfirmed: appointment.buyerConfirmed,
        sellerConfirmed: appointment.sellerConfirmed,
        confirmedAt: appointment.confirmedAt
      },
      
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt
    }));

    res.json({
      success: true,
      message: 'Lấy danh sách appointment thành công',
      data: formattedAppointments,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      },
      filters: {
        status: status || 'CONFIRMED,PENDING,RESCHEDULED,COMPLETED',
        search: search || ''
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
