import Appointment from "../models/Appointment";
import DepositRequest from "../models/DepositRequest";
import Listing from "../models/Listing";
import Auction from "../models/Auction";
import { EmailService } from "./emailService";
import walletService from "./walletService";

const emailService = new EmailService();

export class AppointmentService {
  // Tạo lịch hẹn mới từ deposit request
  async createAppointmentFromDeposit(data: {
    depositRequestId: string;
    userId: string;
    scheduledDate?: Date;
    location?: string;
    notes?: string;
  }) {
    // Kiểm tra deposit request tồn tại
    const depositRequest = await DepositRequest.findById(data.depositRequestId);
    if (!depositRequest) {
      throw new Error("Không tìm thấy yêu cầu đặt cọc");
    }

    // Kiểm tra quyền
    const buyerId = depositRequest.buyerId.toString();
    const sellerId = depositRequest.sellerId.toString();
    
    if (buyerId !== data.userId && sellerId !== data.userId) {
      throw new Error("Bạn không có quyền tạo lịch hẹn cho giao dịch này");
    }

    // Kiểm tra trạng thái deposit
    if (depositRequest.status !== "IN_ESCROW") {
      throw new Error("Yêu cầu đặt cọc chưa được xác nhận hoặc đã hoàn thành");
    }

    // Kiểm tra đã có lịch hẹn chưa
    const existingAppointment = await Appointment.findOne({
      depositRequestId: data.depositRequestId,
      status: { $in: ["PENDING", "CONFIRMED", "RESCHEDULED"] },
    });

    if (existingAppointment) {
      throw new Error("Đã có lịch hẹn cho giao dịch này");
    }

    // Tạo lịch hẹn mặc định 1 tuần sau nếu không có
    let appointmentDate = data.scheduledDate ? new Date(data.scheduledDate) : new Date();
    if (!data.scheduledDate) {
      appointmentDate.setDate(appointmentDate.getDate() + 7);
    }

    // Xác định ai tạo appointment
    const isBuyer = buyerId === data.userId;
    const isSeller = sellerId === data.userId;
    const createdBy = isSeller ? 'SELLER' : 'BUYER';
    
    // Người tạo tự động được xác nhận
    const buyerConfirmed = isBuyer;
    const sellerConfirmed = isSeller;
    const now = new Date();

    const appointment = await Appointment.create({
      depositRequestId: data.depositRequestId,
      appointmentType: 'NORMAL_DEPOSIT',
      buyerId: buyerId,
      sellerId: sellerId,
      createdBy: createdBy,
      scheduledDate: appointmentDate,
      status: "PENDING",
      type: "CONTRACT_SIGNING",
      location: data.location || "Văn phòng công ty",
      notes: data.notes || "Ký kết hợp đồng mua bán xe",
      buyerConfirmed: buyerConfirmed,
      sellerConfirmed: sellerConfirmed,
      buyerConfirmedAt: buyerConfirmed ? now : undefined,
      sellerConfirmedAt: sellerConfirmed ? now : undefined,
      rescheduledCount: 0,
      maxReschedules: 3,
    });

    // Populate thông tin
    await appointment.populate("buyerId", "fullName email phone");
    await appointment.populate("sellerId", "fullName email phone");

    // Cập nhật listing status thành InTransaction (đã có khách hẹn xem xe)
    const listing = await Listing.findById(depositRequest.listingId);
    if (listing && listing.status === 'Published') {
      listing.status = 'InTransaction';
      await listing.save();
      console.log(`✅ Updated listing ${listing._id} status to InTransaction`);
    }

    // Gửi email thông báo
    try {
      // await emailService.sendAppointmentCreated(buyerId, sellerId, appointment as any);
      console.log('TODO: Send appointment created email');
    } catch (error) {
      console.error("Error sending appointment email:", error);
    }

    return appointment;
  }

  // Tạo lịch hẹn từ auction (cho người thắng cuộc)
  async createAppointmentFromAuction(data: {
    auctionId: string;
    userId: string;
    scheduledDate?: Date;
    location?: string;
    notes?: string;
  }) {
    // Kiểm tra auction tồn tại
    const auction = await Auction.findById(data.auctionId).populate('listingId');
    if (!auction) {
      throw new Error("Không tìm thấy phiên đấu giá");
    }

    // Kiểm tra auction đã kết thúc
    if (auction.status !== 'ended') {
      throw new Error("Phiên đấu giá chưa kết thúc");
    }

    // Kiểm tra có người thắng cuộc không
    if (!auction.winnerId) {
      throw new Error("Phiên đấu giá không có người thắng cuộc");
    }

    // Lấy thông tin listing
    const listing = auction.listingId as any;
    if (!listing) {
      throw new Error("Không tìm thấy thông tin sản phẩm");
    }
    const sellerId = listing.sellerId.toString();
    const winnerId = auction.winnerId.toString();

    // Kiểm tra user có quyền tạo appointment không (winner HOẶC seller)
    const isWinner = winnerId === data.userId;
    const isSeller = sellerId === data.userId;
    
    if (!isWinner && !isSeller) {
      throw new Error("Chỉ người thắng cuộc hoặc người bán mới được tạo lịch hẹn");
    }

    // Kiểm tra đã có lịch hẹn chưa
    const existingAppointment = await Appointment.findOne({
      auctionId: data.auctionId,
      status: { $in: ["PENDING", "CONFIRMED", "RESCHEDULED"] },
    });

    if (existingAppointment) {
      throw new Error("Đã có lịch hẹn cho phiên đấu giá này");
    }

    // Tạo lịch hẹn mặc định 1 tuần sau nếu không có
    let appointmentDate = data.scheduledDate ? new Date(data.scheduledDate) : new Date();
    if (!data.scheduledDate) {
      appointmentDate.setDate(appointmentDate.getDate() + 7);
    }

    // Xác định ai tạo appointment
    const createdBy = isSeller ? 'SELLER' : 'BUYER';
    const now = new Date();
    
    // Người tạo tự động xác nhận
    const buyerConfirmed = isWinner; // Winner tạo thì buyer confirmed
    const sellerConfirmed = isSeller; // Seller tạo thì seller confirmed

    const appointment = await Appointment.create({
      auctionId: data.auctionId,
      appointmentType: 'AUCTION',
      buyerId: winnerId,
      sellerId: sellerId,
      createdBy: createdBy,
      scheduledDate: appointmentDate,
      status: "PENDING",
      type: "CONTRACT_SIGNING",
      location: data.location || "Văn phòng công ty",
      notes: data.notes || `Ký kết hợp đồng mua bán xe - Đấu giá thành công với giá ${auction.winningBid?.price?.toLocaleString('vi-VN')} VNĐ`,
      buyerConfirmed: buyerConfirmed,
      sellerConfirmed: sellerConfirmed,
      buyerConfirmedAt: buyerConfirmed ? now : undefined,
      sellerConfirmedAt: sellerConfirmed ? now : undefined,
      rescheduledCount: 0,
      maxReschedules: 3,
    });

    // Populate thông tin
    await appointment.populate("buyerId", "fullName email phone");
    await appointment.populate("sellerId", "fullName email phone");
    await appointment.populate("auctionId");

    // Cập nhật listing status thành InTransaction (đã có khách hẹn xem xe)
    const listingToUpdate = await Listing.findById(listing._id);
    if (listingToUpdate && listingToUpdate.status === 'Published') {
      listingToUpdate.status = 'InTransaction';
      await listingToUpdate.save();
      console.log(`✅ Updated listing ${listingToUpdate._id} status to InTransaction (from auction)`);
    }

    // Gửi thông báo cho buyer và seller
    try {
      const NotificationMessage = (await import('../models/NotificationMessage')).default;
      const { WebSocketService } = await import('./websocketService');
      const wsService = WebSocketService.getInstance();

      const vehicleInfo = `${listing.make} ${listing.model} ${listing.year}`;
      const scheduledDateStr = appointmentDate.toLocaleString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Thông báo cho người tạo (đã tự động confirmed)
      const creatorId = isWinner ? winnerId : sellerId;
      const creatorRole = isWinner ? 'buyer' : 'seller';
      await NotificationMessage.create({
        userId: creatorId,
        type: 'system',
        title: 'Lịch hẹn đã được tạo',
        message: `Bạn đã tạo lịch hẹn ký hợp đồng cho xe ${vehicleInfo} vào ${scheduledDateStr}. Chờ ${creatorRole === 'buyer' ? 'người bán' : 'người thắng đấu giá'} xác nhận.`,
        relatedId: appointment._id.toString(),
        actionUrl: `/appointments/${appointment._id}`,
        actionText: 'Xem lịch hẹn',
        metadata: {
          appointmentId: appointment._id.toString(),
          auctionId: data.auctionId,
          appointmentType: 'AUCTION',
          scheduledDate: appointmentDate,
          notificationType: 'appointment_created_self'
        }
      });

      wsService.sendToUser(creatorId, 'appointment_created', {
        appointmentId: appointment._id.toString(),
        title: 'Lịch hẹn đã được tạo',
        message: 'Lịch hẹn ký hợp đồng đã được tạo thành công',
        scheduledDate: appointmentDate
      });

      // Thông báo cho bên còn lại (cần confirm)
      const recipientId = isWinner ? sellerId : winnerId;
      const recipientRole = isWinner ? 'seller' : 'buyer';
      const creatorName = isWinner ? 'Người thắng đấu giá' : 'Người bán';
      
      await NotificationMessage.create({
        userId: recipientId,
        type: 'system',
        title: 'Lịch hẹn mới từ đấu giá',
        message: `${creatorName} đã tạo lịch hẹn ký hợp đồng cho xe ${vehicleInfo} vào ${scheduledDateStr}. Vui lòng xác nhận lịch hẹn.`,
        relatedId: appointment._id.toString(),
        actionUrl: `/appointments/${appointment._id}`,
        actionText: 'Xác nhận lịch hẹn',
        metadata: {
          appointmentId: appointment._id.toString(),
          auctionId: data.auctionId,
          appointmentType: 'AUCTION',
          scheduledDate: appointmentDate,
          createdBy: creatorRole,
          notificationType: 'appointment_created_pending'
        }
      });

      wsService.sendToUser(recipientId, 'new_appointment', {
        appointmentId: appointment._id.toString(),
        title: 'Lịch hẹn mới từ đấu giá',
        message: `${creatorName} đã tạo lịch hẹn ký hợp đồng`,
        scheduledDate: appointmentDate,
        needsConfirmation: true
      });

      console.log(`✅ Sent appointment notifications for auction ${data.auctionId}`);
    } catch (error) {
      console.error("Error sending appointment notifications:", error);
    }

    return appointment;
  }

  // Dời lịch hẹn
  async rescheduleAppointment(
    appointmentId: string,
    newDate: Date,
    reason: string,
    userId: string
  ) {
    const appointment = await Appointment.findById(appointmentId)
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .populate("listingId", "make model year");

    if (!appointment) {
      throw new Error("Không tìm thấy lịch hẹn");
    }

    // Kiểm tra quyền
    const isBuyer = (appointment.buyerId as any)._id?.toString() === userId;
    const isSeller = (appointment.sellerId as any)._id?.toString() === userId;

    if (!isBuyer && !isSeller) {
      throw new Error("Bạn không có quyền dời lịch hẹn này");
    }

    if (appointment.status !== "PENDING") {
      throw new Error("Không thể dời lịch hẹn đã xác nhận hoặc đã hủy");
    }

    if (appointment.rescheduledCount >= appointment.maxReschedules) {
      // Tự động hủy nếu vượt quá số lần dời
      return await this.cancelAppointment(
        appointmentId,
        "Vượt quá số lần dời lịch cho phép",
        userId
      );
    }

    // Lưu lịch sử dời lịch (comment out vì rescheduleHistory không có trong IAppointment interface)
    const oldDate = appointment.scheduledDate;
    appointment.rescheduledCount += 1;

    // if (!(appointment as any).rescheduleHistory) {
    //   (appointment as any).rescheduleHistory = [];
    // }
    // (appointment as any).rescheduleHistory.push({
    //   previousDate: oldDate,
    //   newDate: newDate,
    //   reason: reason,
    //   rescheduledBy: userId,
    //   rescheduledAt: new Date()
    // });

    // Cập nhật lịch hẹn
    appointment.scheduledDate = newDate;
    
    // Reset trạng thái xác nhận
    appointment.buyerConfirmed = false;
    appointment.sellerConfirmed = false;

    await appointment.save();

    // Gửi email thông báo (TODO: implement method)
    try {
      // await emailService.sendAppointmentRescheduled(...);
      console.log('TODO: Send appointment rescheduled email');
    } catch (error) {
      console.error("Error sending reschedule email:", error);
    }

    return appointment;
  }

  // Xác nhận lịch hẹn
  async confirmAppointment(appointmentId: string, userId: string) {
    const appointment = await Appointment.findById(appointmentId)
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .populate("listingId", "make model year");

    if (!appointment) {
      throw new Error("Không tìm thấy lịch hẹn");
    }

    // Xác định user là buyer hay seller
    const isBuyer = (appointment.buyerId as any)._id?.toString() === userId;
    const isSeller = (appointment.sellerId as any)._id?.toString() === userId;

    if (!isBuyer && !isSeller) {
      throw new Error("Bạn không có quyền xác nhận lịch hẹn này");
    }

    // Cập nhật trạng thái xác nhận
    if (isBuyer) {
      appointment.buyerConfirmed = true;
      appointment.buyerConfirmedAt = new Date();
    } else {
      appointment.sellerConfirmed = true;
      appointment.sellerConfirmedAt = new Date();
    }

    // Nếu cả 2 bên đã xác nhận
    if (appointment.buyerConfirmed && appointment.sellerConfirmed) {
      appointment.status = "CONFIRMED";
      appointment.confirmedAt = new Date();

      // Gửi email thông báo (TODO: implement email method)
      try {
        // await emailService.sendAppointmentConfirmed(...);
        console.log('TODO: Send appointment confirmed email');
      } catch (error) {
        console.error("Error sending confirmation email:", error);
      }
    }

    await appointment.save();
    
    // Tạo message tương ứng
    const message = appointment.status === "CONFIRMED"
      ? "Xác nhận lịch hẹn thành công - Cả hai bên đã xác nhận"
      : isBuyer
        ? "Bạn đã xác nhận, hãy đợi người bán xác nhận"
        : "Bạn đã xác nhận, hãy đợi người mua xác nhận";
    
    return {
      appointment,
      message
    };
  }

  // Từ chối lịch hẹn và tự động dời lịch
  async rejectAppointment(appointmentId: string, userId: string, reason?: string) {
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      throw new Error("Không tìm thấy lịch hẹn");
    }

    // Kiểm tra quyền từ chối (chỉ người mua hoặc người bán)
    if (appointment.buyerId.toString() !== userId && appointment.sellerId.toString() !== userId) {
      throw new Error("Bạn không có quyền từ chối lịch hẹn này");
    }

    // Kiểm tra trạng thái
    if (appointment.status === "COMPLETED" || appointment.status === "CANCELLED") {
      throw new Error("Không thể từ chối lịch hẹn đã hoàn thành hoặc đã hủy");
    }

    // Kiểm tra số lần dời lịch
    if (appointment.rescheduledCount >= appointment.maxReschedules) {
      // Tự động hủy appointment và hoàn tiền
      appointment.status = "CANCELLED";
      appointment.cancelledAt = new Date();
      appointment.notes = "Hủy do hết số lần dời lịch cho phép";
      
      await appointment.save();
      
      // Hoàn tiền từ Escrow về ví người mua
      try {
        await walletService.refundFromEscrow(appointment.depositRequestId as any);
      } catch (refundError) {
        console.error("Lỗi hoàn tiền:", refundError);
        // Vẫn tiếp tục xử lý dù có lỗi hoàn tiền
      }
      
      // Gửi email thông báo hủy (TODO: implement email method)
      try {
        // await emailService.sendAppointmentCancelledNotification(...);
        console.log('TODO: Send appointment cancelled email');
      } catch (emailError) {
        console.error("Lỗi gửi email thông báo hủy:", emailError);
      }
      
      return {
        message: "Đã hết số lần dời lịch. Appointment đã bị hủy và tiền đã hoàn về ví người mua.",
        appointment: {
          id: appointment._id,
          status: appointment.status,
          cancelledAt: appointment.cancelledAt,
          rescheduledCount: appointment.rescheduledCount
        }
      };
    }

    // Tự động dời lịch 1 tuần
    const newScheduledDate = new Date();
    newScheduledDate.setDate(newScheduledDate.getDate() + 7);

    // Reset trạng thái xác nhận
    appointment.scheduledDate = newScheduledDate;
    appointment.status = "RESCHEDULED";
    appointment.rescheduledCount += 1;
    appointment.buyerConfirmed = false;
    appointment.sellerConfirmed = false;
    appointment.buyerConfirmedAt = undefined;
    appointment.sellerConfirmedAt = undefined;
    appointment.confirmedAt = undefined;
    appointment.notes = reason || appointment.notes;

    await appointment.save();

    // Gửi email thông báo dời lịch (TODO: implement email method)
    try {
      // const rejecterName = appointment.buyerId.toString() === userId ? "người mua" : "người bán";
      // const reasonText = `Vì lý do ${reason || "cá nhân"} từ phía ${rejecterName}, hệ thống quyết định dời lại lịch hẹn 1 tuần.`;
      // await emailService.sendRescheduleNotification(...);
      console.log('TODO: Send reschedule notification email');
    } catch (emailError) {
      console.error("Lỗi gửi email thông báo dời lịch:", emailError);
    }

    return {
      message: "Đã từ chối lịch hẹn. Hệ thống đã tự động dời lịch 1 tuần và gửi thông báo cho cả hai bên.",
      appointment: {
        id: appointment._id,
        scheduledDate: appointment.scheduledDate,
        status: appointment.status,
        rescheduledCount: appointment.rescheduledCount,
        buyerConfirmed: appointment.buyerConfirmed,
        sellerConfirmed: appointment.sellerConfirmed
      }
    };
  }

  // Hủy lịch hẹn
  async cancelAppointment(appointmentId: string, reason: string, userId: string) {
    const appointment = await Appointment.findById(appointmentId)
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .populate("depositRequestId")
      .populate({
        path: "auctionId",
        populate: { path: "listingId" }
      });

    if (!appointment) {
      throw new Error("Không tìm thấy lịch hẹn");
    }

    // Kiểm tra quyền
    const isBuyer = (appointment.buyerId as any)._id?.toString() === userId;
    const isSeller = (appointment.sellerId as any)._id?.toString() === userId;

    if (!isBuyer && !isSeller) {
      throw new Error("Bạn không có quyền hủy lịch hẹn này");
    }

    // Cập nhật trạng thái
    appointment.status = "CANCELLED";
    appointment.cancelledAt = new Date();
    appointment.notes = reason; // Lưu lý do vào notes

    await appointment.save();

    // Cập nhật listing status về Published (để có thể bán lại)
    let listingId;
    if (appointment.appointmentType === 'AUCTION' && appointment.auctionId) {
      const auction = appointment.auctionId as any;
      listingId = auction?.listingId?._id || auction?.listingId;
    } else if (appointment.depositRequestId) {
      const depositRequest = appointment.depositRequestId as any;
      listingId = depositRequest?.listingId;
    }

    if (listingId) {
      const listing = await Listing.findById(listingId);
      if (listing && listing.status === 'InTransaction') {
        listing.status = 'Published';
        await listing.save();
        console.log(`✅ Reverted listing ${listing._id} status to Published (appointment cancelled)`);
      }
    }

    // Hoàn tiền cọc nếu có (logic này phụ thuộc vào business rule)
    // Ví dụ: nếu seller hủy thì hoàn 100%, buyer hủy thì hoàn 50%
    // TODO: Implement refund logic here if needed

    // Gửi email thông báo (TODO: implement email method)
    try {
      // await emailService.sendAppointmentCancelled(...);
      console.log('TODO: Send appointment cancelled email');
    } catch (error) {
      console.error("Error sending cancel email:", error);
    }

    return appointment;
  }

  // Hoàn thành lịch hẹn
  async completeAppointment(appointmentId: string, userId: string) {
    const appointment = await Appointment.findById(appointmentId)
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .populate("listingId", "make model year");

    if (!appointment) {
      throw new Error("Không tìm thấy lịch hẹn");
    }

    // Chỉ seller mới có thể đánh dấu hoàn thành
    if ((appointment.sellerId as any)._id?.toString() !== userId) {
      throw new Error("Chỉ người bán mới có thể đánh dấu hoàn thành");
    }

    if (appointment.status !== "CONFIRMED") {
      throw new Error("Chỉ có thể hoàn thành lịch hẹn đã được xác nhận");
    }

    appointment.status = "COMPLETED";
    appointment.completedAt = new Date();

    await appointment.save();

    // Gửi email thông báo (TODO: implement email method)
    try {
      // await emailService.sendAppointmentCompleted(...);
      console.log('TODO: Send appointment completed email');
    } catch (error) {
      console.error("Error sending completion email:", error);
    }

    return appointment;
  }

  // Lấy danh sách lịch hẹn của user
  async getUserAppointments(
    userId: string, 
    status?: string, 
    type?: string,
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {
      $or: [
        { buyerId: userId },
        { sellerId: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    if (type) {
      query.type = type;
    }

    const appointments = await Appointment.find(query)
      .populate("buyerId", "fullName email phone avatar")
      .populate("sellerId", "fullName email phone avatar")
      .populate("listingId", "make model year photos priceListed")
      .populate("depositRequestId", "depositAmount status")
      .sort({ scheduledDate: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);

    return {
      data: appointments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    };
  }

  // Lấy chi tiết lịch hẹn
  async getAppointmentById(appointmentId: string, userId: string) {
    const appointment = await Appointment.findById(appointmentId)
      .populate("buyerId", "fullName email phone avatar")
      .populate("sellerId", "fullName email phone avatar")
      .populate("listingId", "make model year photos priceListed");

    if (!appointment) {
      throw new Error("Không tìm thấy lịch hẹn");
    }

    // Kiểm tra quyền xem
    const isBuyer = (appointment.buyerId as any)._id?.toString() === userId;
    const isSeller = (appointment.sellerId as any)._id?.toString() === userId;

    if (!isBuyer && !isSeller) {
      throw new Error("Bạn không có quyền xem lịch hẹn này");
    }

    return appointment;
  }

  // Lấy danh sách appointment cho staff
  async getStaffAppointments(
    status?: string,
    search?: string,
    page: number = 1,
    limit: number = 10
  ) {
    const filter: any = {};
    
    // Chỉ lấy appointment đã xác nhận hoặc đang chờ
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ['CONFIRMED', 'PENDING', 'RESCHEDULED'] };
    }

    // Search theo tên người mua/bán hoặc ID
    if (search) {
      const searchRegex = new RegExp(search, 'i');
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
          select: 'make model year priceListed'
        }
      })
      .sort({ scheduledDate: 1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(filter);

    return {
      data: appointments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    };
  }

  // Lấy thống kê lịch hẹn
  async getAppointmentStats(userId: string) {
    const appointments = await Appointment.find({
      $or: [{ buyerId: userId }, { sellerId: userId }]
    });

    const stats = {
      total: appointments.length,
      pending: appointments.filter(a => a.status === "PENDING").length,
      confirmed: appointments.filter(a => a.status === "CONFIRMED").length,
      completed: appointments.filter(a => a.status === "COMPLETED").length,
      cancelled: appointments.filter(a => a.status === "CANCELLED").length
    };

    return stats;
  }
}

export default new AppointmentService();

