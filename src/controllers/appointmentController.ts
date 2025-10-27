import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
import { User } from '../models/User';
import emailService from '../services/emailService';
import walletService from '../services/walletService';

// Tạo lịch hẹn sau khi người bán xác nhận cọc
export const createAppointment = async (req: Request, res: Response) => {
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
      buyerId: depositRequest.buyerId,
      sellerId: depositRequest.sellerId,
            scheduledDate: appointmentDate,
      status: 'PENDING',
      type: 'CONTRACT_SIGNING',
      location: location || 'Văn phòng công ty',
      notes: notes || 'Ký kết hợp đồng mua bán xe'
        });

        await appointment.save();

    // TODO: Gửi thông báo cho cả 2 bên
    // await notificationService.sendAppointmentNotification(
    //   depositRequest.buyerId, 
    //   appointment
    // );
    // await notificationService.sendAppointmentNotification(
    //   depositRequest.sellerId, 
    //   appointment
    // );

    res.json({
      success: true,
      message: 'Đã tạo lịch hẹn ký hợp đồng',
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
export const confirmAppointment = async (req: Request, res: Response) => {
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

    // Kiểm tra quyền xác nhận (chỉ người mua hoặc người bán)
    if (appointment.buyerId !== userId && appointment.sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xác nhận lịch hẹn này'
      });
    }

    // Kiểm tra trạng thái
    if (appointment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn đã được xác nhận hoặc đã hoàn thành'
      });
    }

    // Kiểm tra xem user đã xác nhận chưa
    const isBuyer = appointment.buyerId === userId;
    const isSeller = appointment.sellerId === userId;
    
    // Thêm trường để track ai đã xác nhận
    if (!appointment.buyerConfirmed && !appointment.sellerConfirmed) {
      // Lần đầu tiên có người xác nhận
      if (isBuyer) {
        appointment.buyerConfirmed = true;
        appointment.buyerConfirmedAt = new Date();
      } else if (isSeller) {
        appointment.sellerConfirmed = true;
        appointment.sellerConfirmedAt = new Date();
      }
      
      await appointment.save();

        res.json({
        success: true,
        message: isBuyer ? 'Bạn đã xác nhận, hãy đợi người bán xác nhận' : 'Bạn đã xác nhận, hãy đợi người mua xác nhận',
        appointment: {
          id: appointment._id,
          scheduledDate: appointment.scheduledDate,
          status: appointment.status,
          buyerConfirmed: appointment.buyerConfirmed,
          sellerConfirmed: appointment.sellerConfirmed
        }
      });
    } else {
      // Người thứ 2 xác nhận
      if (isBuyer && !appointment.buyerConfirmed) {
        appointment.buyerConfirmed = true;
        appointment.buyerConfirmedAt = new Date();
      } else if (isSeller && !appointment.sellerConfirmed) {
        appointment.sellerConfirmed = true;
        appointment.sellerConfirmedAt = new Date();
      }
      
      // Kiểm tra cả 2 đã xác nhận chưa
      if (appointment.buyerConfirmed && appointment.sellerConfirmed) {
        appointment.status = 'CONFIRMED';
        appointment.confirmedAt = new Date();
        
        // Gửi email thông báo xác nhận
        try {
          await emailService.sendAppointmentConfirmedNotification(
            appointment.buyerId,
            appointment.sellerId,
            appointment
          );
        } catch (emailError) {
          console.error('Lỗi gửi email thông báo xác nhận:', emailError);
        }
      }
      
      await appointment.save();
      
      if (appointment.status === 'CONFIRMED') {
        res.json({
          success: true,
          message: 'Xác nhận lịch hẹn thành công - Cả hai bên đã xác nhận',
          appointment: {
            id: appointment._id,
            scheduledDate: appointment.scheduledDate,
            status: appointment.status,
            buyerConfirmed: appointment.buyerConfirmed,
            sellerConfirmed: appointment.sellerConfirmed
          }
        });
      } else {
        res.json({
          success: true,
          message: isBuyer ? 'Bạn đã xác nhận, hãy đợi người bán xác nhận' : 'Bạn đã xác nhận, hãy đợi người mua xác nhận',
          appointment: {
            id: appointment._id,
                scheduledDate: appointment.scheduledDate,
                status: appointment.status,
            buyerConfirmed: appointment.buyerConfirmed,
            sellerConfirmed: appointment.sellerConfirmed
          }
            });
      }
        }

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
export const rejectAppointment = async (req: Request, res: Response) => {
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

    // Kiểm tra quyền từ chối (chỉ người mua hoặc người bán)
    if (appointment.buyerId !== userId && appointment.sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền từ chối lịch hẹn này'
      });
    }

    // Kiểm tra trạng thái
    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Không thể từ chối lịch hẹn đã hoàn thành hoặc đã hủy'
      });
    }

    // Kiểm tra số lần dời lịch
    if (appointment.rescheduledCount >= appointment.maxReschedules) {
      // Tự động hủy appointment và hoàn tiền
      appointment.status = 'CANCELLED';
      appointment.cancelledAt = new Date();
      appointment.notes = 'Hủy do hết số lần dời lịch cho phép';
      
      await appointment.save();
      
      // Hoàn tiền từ Escrow về ví người mua
      try {
        await walletService.refundFromEscrow(appointment.depositRequestId);
      } catch (refundError) {
        console.error('Lỗi hoàn tiền:', refundError);
        // Vẫn tiếp tục xử lý dù có lỗi hoàn tiền
      }
      
      // Gửi email thông báo hủy
      try {
        await emailService.sendAppointmentCancelledNotification(
          appointment.buyerId,
          appointment.sellerId,
          appointment,
          'Hủy do hết số lần dời lịch cho phép'
        );
      } catch (emailError) {
        console.error('Lỗi gửi email thông báo hủy:', emailError);
      }
      
      return res.json({
        success: true,
        message: 'Đã hết số lần dời lịch. Appointment đã bị hủy và tiền đã hoàn về ví người mua.',
        appointment: {
          id: appointment._id,
          status: appointment.status,
          cancelledAt: appointment.cancelledAt,
          rescheduledCount: appointment.rescheduledCount
        }
      });
    }

    // Tự động dời lịch 1 tuần
    const newScheduledDate = new Date();
    newScheduledDate.setDate(newScheduledDate.getDate() + 7);

    // Reset trạng thái xác nhận
    appointment.scheduledDate = newScheduledDate;
    appointment.status = 'RESCHEDULED';
    appointment.rescheduledCount += 1;
    appointment.buyerConfirmed = false;
    appointment.sellerConfirmed = false;
    appointment.buyerConfirmedAt = undefined;
    appointment.sellerConfirmedAt = undefined;
    appointment.confirmedAt = undefined;
    appointment.notes = reason || appointment.notes;

    await appointment.save();

    // Gửi email thông báo dời lịch
    try {
      const rejecterName = appointment.buyerId === userId ? 'người mua' : 'người bán';
      const reasonText = `Vì lý do ${reason || 'cá nhân'} từ phía ${rejecterName}, hệ thống quyết định dời lại lịch hẹn 1 tuần.`;
      
      await emailService.sendRescheduleNotification(
        appointment.buyerId,
        appointment.sellerId,
        appointment,
        reasonText
      );
    } catch (emailError) {
      console.error('Lỗi gửi email thông báo dời lịch:', emailError);
    }

        res.json({
      success: true,
      message: 'Đã từ chối lịch hẹn. Hệ thống đã tự động dời lịch 1 tuần và gửi thông báo cho cả hai bên.',
      appointment: {
        id: appointment._id,
        scheduledDate: appointment.scheduledDate,
        status: appointment.status,
        rescheduledCount: appointment.rescheduledCount,
        buyerConfirmed: appointment.buyerConfirmed,
        sellerConfirmed: appointment.sellerConfirmed
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
export const rescheduleAppointment = async (req: Request, res: Response) => {
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
export const cancelAppointment = async (req: Request, res: Response) => {
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
export const getUserAppointments = async (req: Request, res: Response) => {
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
      .populate('buyerId', 'name email phone')
      .populate('sellerId', 'name email phone')
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
export const getAppointmentDetails = async (req: Request, res: Response) => {
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
export const getStaffAppointments = async (req: Request, res: Response) => {
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
    
    // Chỉ lấy appointment đã xác nhận hoặc đang chờ
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ['CONFIRMED', 'PENDING', 'RESCHEDULED'] };
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
      .populate('buyerId', 'name email phone')
      .populate('sellerId', 'name email phone')
      .populate({
        path: 'depositRequestId',
        populate: {
          path: 'listingId',
          select: 'title brand model year price'
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
        name: appointment.buyerId.name,
        email: appointment.buyerId.email,
        phone: appointment.buyerId.phone
      },
      
      // Thông tin người bán
      seller: {
        id: appointment.sellerId._id,
        name: appointment.sellerId.name,
        email: appointment.sellerId.email,
        phone: appointment.sellerId.phone
      },
      
      // Thông tin xe
      vehicle: {
        title: (appointment.depositRequestId as any).listingId?.title || 'N/A',
        brand: (appointment.depositRequestId as any).listingId?.brand || 'N/A',
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
        status: status || 'CONFIRMED,PENDING,RESCHEDULED',
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
