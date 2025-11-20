import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
import Contract from '../models/Contract';
import { User } from '../models/User';
import emailService from '../services/emailService';
import { uploadFromBuffer } from "../services/cloudinaryService";
import walletService from '../services/walletService';
import systemWalletService from "../services/systemWalletService";
import depositNotificationService from '../services/depositNotificationService';
import Chat from '../models/Chat';
import { WebSocketService } from '../services/websocketService';
import dealService from '../services/dealService';
import { buildDefaultTimeline } from '../constants/contractTimeline';

const mapAppointmentTypeToMilestone = (
  type?: string
): "signContract" | "notarization" | "handover" | undefined => {
  switch (type) {
    case "CONTRACT_SIGNING":
      return "signContract";
    case "CONTRACT_NOTARIZATION":
      return "notarization";
    case "VEHICLE_HANDOVER":
    case "DELIVERY":
      return "handover";
    case "DELIVERY":
    case "VEHICLE_DELIVERY":
      return "handover";
    default:
      return undefined;
  }
};

export const createAppointmentFromChat = async (req: Request, res: Response) => {
  try {
    const { chatId, scheduledDate, location, notes } = req.body || {};
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập',
      });
    }

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu chatId',
      });
    }

    const chat = await Chat.findById(chatId)
      .populate('listingId', 'make model year priceListed status sellerId')
      .populate('buyerId', 'fullName email phone')
      .populate('sellerId', 'fullName email phone');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện',
      });
    }

    // ⚠️ Lưu ý: buyerId / sellerId có thể là ObjectId hoặc document (do populate)
    // Nếu là document, .toString() sẽ trả "[object Object]" -> so sánh sai
    const buyerId =
      (chat.buyerId && (chat.buyerId as any)._id?.toString()) ||
      chat.buyerId?.toString();
    const sellerId =
      (chat.sellerId && (chat.sellerId as any)._id?.toString()) ||
      chat.sellerId?.toString();

    const listingIdValue =
      (chat.listingId && (chat.listingId as any)._id?.toString()) ||
      chat.listingId?.toString();

    if (!buyerId || !sellerId) {
      return res.status(400).json({
        success: false,
        message: 'Cuộc trò chuyện không hợp lệ',
      });
    }

    const isBuyer = buyerId === userId;
    const isSeller = sellerId === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền tạo lịch hẹn từ cuộc trò chuyện này',
      });
    }

    // Không cho tạo trùng lịch hẹn đang active cho cùng chat
    const existingAppointment = await Appointment.findOne({
      chatId,
      status: { $in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'Đã có lịch hẹn đang hoạt động cho cuộc trò chuyện này',
        appointmentId: existingAppointment._id,
      });
    }

    let appointmentDate: Date;
    if (scheduledDate) {
      appointmentDate = new Date(scheduledDate);
      if (isNaN(appointmentDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Ngày hẹn không hợp lệ',
        });
      }
    } else {
      appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 3);
    }

    if (appointmentDate.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Ngày hẹn phải lớn hơn hiện tại',
      });
    }

    const now = new Date();
    const createdBy = isSeller ? 'SELLER' : 'BUYER';

    const appointment = await Appointment.create({
      chatId,
      listingId: listingIdValue || undefined,
      appointmentType: 'NORMAL_DEPOSIT',
      buyerId,
      sellerId,
      createdBy,
      scheduledDate: appointmentDate,
      status: 'PENDING',
      type: 'VEHICLE_INSPECTION',
      location: location || 'Thỏa thuận thêm trong cuộc trò chuyện',
      notes,
      buyerConfirmed: isBuyer,
      sellerConfirmed: isSeller,
      buyerConfirmedAt: isBuyer ? now : undefined,
      sellerConfirmedAt: isSeller ? now : undefined,
    });

    let createdDealId: string | undefined;
    if (listingIdValue) {
      const listingFromChat = chat.listingId as any;
      const vehiclePrice =
        listingFromChat?.priceListed ||
        listingFromChat?.price ||
        listingFromChat?.expectedPrice ||
        0;

      if (vehiclePrice > 0) {
        try {
          const depositAmount = Math.round(vehiclePrice * 0.1);
          const deal = await dealService.createDeal({
            listingId: listingIdValue,
            buyerId,
            sellerId,
            dealType: "DEPOSIT",
            source: "NORMAL_DEPOSIT",
            paymentPlan: {
              vehiclePrice,
              depositAmount,
              remainingAmount: Math.max(vehiclePrice - depositAmount, 0),
            },
            notes: `Deal tạo từ appointment chat ${appointment._id}`,
            createdBy: userId,
          });

          createdDealId = (deal._id as any)?.toString?.() || "";
          appointment.dealId = createdDealId;
          await appointment.save();

          const milestone = mapAppointmentTypeToMilestone(appointment.type);
          if (milestone && createdDealId) {
            try {
              await dealService.updateAppointmentMilestone(createdDealId, milestone, {
                appointmentId: (appointment._id as any)?.toString?.(),
                status: "SCHEDULED",
                scheduledAt: appointment.scheduledDate,
              });
            } catch (err) {
              console.error("Error updating deal milestone:", err);
            }
          }
        } catch (dealError) {
          console.error("Error creating deal from chat appointment:", dealError);
        }
      }
    }

    // WebSocket notify người còn lại
    try {
      const wsService = WebSocketService.getInstance();
      const notifyUserId = isBuyer ? sellerId : buyerId;
      wsService.sendToUser(notifyUserId, 'appointment_created_from_chat', {
        appointmentId: appointment._id,
        chatId,
        scheduledDate: appointment.scheduledDate,
        location: appointment.location,
        type: appointment.type,
        createdBy,
      });
    } catch (wsError) {
      console.error('Error sending websocket notification:', wsError);
    }

    res.status(201).json({
      success: true,
      message: 'Đã tạo lịch hẹn xem xe thành công',
      appointment: {
        id: appointment._id,
        chatId,
        buyerId,
        sellerId,
        scheduledDate: appointment.scheduledDate,
        location: appointment.location,
        status: appointment.status,
        type: appointment.type,
        createdBy,
        dealId: appointment.dealId || createdDealId,
      },
    });
  } catch (error) {
    console.error('Error creating appointment from chat:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

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

    // Người tạo tự động được xác nhận
    const buyerConfirmed = isBuyer;
    const sellerConfirmed = isSeller;
    const now = new Date();

    const appointment = new Appointment({
      depositRequestId,
      listingId: depositRequest.listingId,
      appointmentType: 'NORMAL_DEPOSIT',
      buyerId: depositRequest.buyerId,
      sellerId: depositRequest.sellerId,
      createdBy: createdBy, // ✅ Lưu ai tạo appointment
            scheduledDate: appointmentDate,
      status: 'PENDING',
      type: 'CONTRACT_SIGNING',
      location: location || 'Văn phòng công ty',
      notes: notes || 'Ký kết hợp đồng mua bán xe',
      buyerConfirmed: buyerConfirmed, // ✅ Người tạo tự động xác nhận
      sellerConfirmed: sellerConfirmed,
      buyerConfirmedAt: buyerConfirmed ? now : undefined,
      sellerConfirmedAt: sellerConfirmed ? now : undefined
    });

    await appointment.save();

    if (appointment.dealId) {
      const milestone = mapAppointmentTypeToMilestone(appointment.type);
      if (milestone) {
        try {
          await dealService.updateAppointmentMilestone(appointment.dealId, milestone, {
            appointmentId: (appointment._id as any)?.toString?.(),
            status: "SCHEDULED",
            scheduledAt: appointment.scheduledDate,
          });
        } catch (err) {
          console.error("Error updating deal milestone:", err);
        }
      }
    }

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

// Staff gửi yêu cầu công chứng với nhiều time slot
export const requestNotarizationAppointment = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'staff' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ nhân viên mới có quyền gửi yêu cầu công chứng'
      });
    }

    const { dealId } = req.params;
    const { proposedSlots, location, notes } = req.body || {};

    if (!dealId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu dealId'
      });
    }

    if (!Array.isArray(proposedSlots) || proposedSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ít nhất 1 slot thời gian'
      });
    }

    const normalizedSlots = proposedSlots
      .map((slot: string) => new Date(slot))
      .filter((slotDate) => !isNaN(slotDate.getTime()) && slotDate.getTime() > Date.now());

    if (normalizedSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Các slot thời gian không hợp lệ hoặc đã qua'
      });
    }

    if (normalizedSlots.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ cho phép tối đa 5 slot đề xuất'
      });
    }

    const deal = await dealService.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy deal tương ứng'
      });
    }

    const firstSlot = normalizedSlots[0];
    const appointment = await Appointment.create({
      dealId: deal._id?.toString(),
      listingId: deal.listingId,
      appointmentType: deal.dealType === 'AUCTION' ? 'AUCTION' : 'NORMAL_DEPOSIT',
      buyerId: deal.buyerId,
      sellerId: deal.sellerId,
      createdBy: 'STAFF',
      scheduledDate: firstSlot,
      status: 'PENDING_CONFIRMATION',
      type: 'CONTRACT_NOTARIZATION',
      location: location || 'Văn phòng công chứng',
      notes,
      proposedSlots: normalizedSlots,
      buyerConfirmed: false,
      sellerConfirmed: false,
      buyerConfirmedAt: undefined,
      sellerConfirmedAt: undefined
    });

    const appointmentIdStr = (appointment as any)?._id?.toString?.();

    if (deal._id && appointmentIdStr) {
      try {
        await dealService.updatePaperworkStep(deal._id.toString(), 'NOTARIZATION', {
          status: 'IN_PROGRESS',
          note: 'Đang chờ buyer & seller chọn lịch công chứng',
          appointmentId: appointmentIdStr
        });
      } catch (err) {
        console.error('Error updating deal paperwork for notarization:', err);
      }

      try {
        await dealService.updateAppointmentMilestone(deal._id.toString(), 'notarization', {
          appointmentId: appointmentIdStr,
          status: 'SCHEDULED',
          scheduledAt: firstSlot
        });
      } catch (err) {
        console.error('Error updating deal milestone for notarization:', err);
      }
    }

    try {
      const contract: any =
        ((deal._id &&
          (await Contract.findOne({ dealId: deal._id.toString() }))) ||
          (await Contract.findOne({ appointmentId: appointmentIdStr })));

      if (contract) {
        if (!contract.paperworkTimeline || contract.paperworkTimeline.length === 0) {
          contract.paperworkTimeline = buildDefaultTimeline(
            contract.contractType || "DEPOSIT"
          ) as any;
        }

        const notarizationStep = contract.paperworkTimeline.find(
          (step: any) => step.step === "NOTARIZATION"
        );

        if (notarizationStep) {
          const notarizationStepAny: any = notarizationStep;
          notarizationStepAny.status = "IN_PROGRESS";
          notarizationStepAny.note = "Đang chờ buyer & seller chọn lịch công chứng";
          notarizationStepAny.appointmentRequired = true;
          notarizationStepAny.appointmentId = appointmentIdStr;
          notarizationStepAny.updatedAt = new Date();
          notarizationStepAny.updatedBy = req.user?.id;
          contract.markModified("paperworkTimeline");
          await contract.save();
        }
      }
    } catch (contractTimelineError) {
      console.error(
        "Error updating contract timeline for notarization request:",
        contractTimelineError
      );
    }

    try {
      const [buyerInfo, sellerInfo, listingInfo] = await Promise.all([
        User.findById(deal.buyerId),
        User.findById(deal.sellerId),
        Listing.findById(deal.listingId),
      ]);

      if (buyerInfo) {
        await depositNotificationService.sendNotarizationRequestNotification(
          buyerInfo._id.toString(),
          appointment,
          sellerInfo,
          listingInfo
        );
      }

      if (sellerInfo) {
        await depositNotificationService.sendNotarizationRequestNotification(
          sellerInfo._id.toString(),
          appointment,
          buyerInfo,
          listingInfo
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending notarization request notification:",
        notificationError
      );
    }

    res.status(201).json({
      success: true,
      message: 'Đã gửi yêu cầu công chứng tới người mua và người bán',
      appointment: {
        id: appointmentIdStr || appointment._id,
        status: appointment.status,
        proposedSlots: appointment.proposedSlots,
        location: appointment.location,
        dealId: appointment.dealId
      }
    });
  } catch (error) {
    console.error('Error requesting notarization appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const requestHandoverAppointment = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = req.user?.role;
    if (userRole !== "staff" && userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền gửi yêu cầu bàn giao xe",
      });
    }

    const { dealId } = req.params;
    const { proposedSlots, location, notes } = req.body || {};

    if (!dealId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu dealId",
      });
    }

    if (!Array.isArray(proposedSlots) || proposedSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp ít nhất 1 slot thời gian",
      });
    }

    const normalizedSlots = proposedSlots
      .map((slot: string) => new Date(slot))
      .filter((slotDate) => !isNaN(slotDate.getTime()) && slotDate.getTime() > Date.now());

    if (normalizedSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Các slot thời gian không hợp lệ hoặc đã qua",
      });
    }

    if (normalizedSlots.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Chỉ cho phép tối đa 5 slot đề xuất",
      });
    }

    const deal = await dealService.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy deal tương ứng",
      });
    }

    const firstSlot = normalizedSlots[0];
    const appointment = await Appointment.create({
      dealId: deal._id?.toString(),
      listingId: deal.listingId,
      appointmentType: deal.dealType === "AUCTION" ? "AUCTION" : "NORMAL_DEPOSIT",
      buyerId: deal.buyerId,
      sellerId: deal.sellerId,
      createdBy: "STAFF",
      scheduledDate: firstSlot,
      status: "PENDING_CONFIRMATION",
      type: "VEHICLE_HANDOVER",
      location: location || "Địa điểm bàn giao",
      notes,
      proposedSlots: normalizedSlots,
      buyerConfirmed: false,
      sellerConfirmed: false,
    });

    const appointmentIdStr = (appointment as any)?._id?.toString?.();

    if (deal._id && appointmentIdStr) {
      try {
        await dealService.updatePaperworkStep(deal._id.toString(), "HANDOVER_PAPERS_AND_CAR", {
          status: "IN_PROGRESS",
          note: "Đang chờ chọn lịch bàn giao xe",
          appointmentId: appointmentIdStr,
        });
      } catch (err) {
        console.error("Error updating deal paperwork for handover:", err);
      }

      try {
        await dealService.updateAppointmentMilestone(deal._id.toString(), "handover", {
          appointmentId: appointmentIdStr,
          status: "SCHEDULED",
          scheduledAt: firstSlot,
        });
      } catch (err) {
        console.error("Error updating deal milestone for handover:", err);
      }
    }

    try {
      const [buyerInfo, sellerInfo, listingInfo] = await Promise.all([
        User.findById(deal.buyerId),
        User.findById(deal.sellerId),
        Listing.findById(deal.listingId),
      ]);

      if (buyerInfo) {
        await depositNotificationService.sendHandoverRequestNotification(
          buyerInfo._id.toString(),
          appointment,
          sellerInfo,
          listingInfo
        );
      }

      if (sellerInfo) {
        await depositNotificationService.sendHandoverRequestNotification(
          sellerInfo._id.toString(),
          appointment,
          buyerInfo,
          listingInfo
        );
      }
    } catch (notificationError) {
      console.error("Error sending handover request notification:", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Đã gửi yêu cầu bàn giao xe tới người mua và người bán",
      appointment: {
        id: appointmentIdStr || appointment._id,
        status: appointment.status,
        proposedSlots: appointment.proposedSlots,
        location: appointment.location,
        dealId: appointment.dealId,
      },
    });
  } catch (error) {
    console.error("Error requesting handover appointment:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Buyer / Seller chọn slot công chứng
export const selectAppointmentSlot = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const { appointmentId } = req.params;
    const { slot } = req.body || {};

    if (!slot) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thời gian slot'
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    if (!appointment.proposedSlots || appointment.proposedSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn này không có slot lựa chọn'
      });
    }

    const slotDate = new Date(slot);
    if (isNaN(slotDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Slot không hợp lệ'
      });
    }

    const slotMatched = appointment.proposedSlots.some(
      (proposed) => new Date(proposed).getTime() === slotDate.getTime()
    );

    if (!slotMatched) {
      return res.status(400).json({
        success: false,
        message: 'Slot không nằm trong danh sách đề xuất'
      });
    }

    const buyerId =
      (appointment.buyerId && (appointment.buyerId as any)._id?.toString()) ||
      appointment.buyerId?.toString();
    const sellerId =
      (appointment.sellerId && (appointment.sellerId as any)._id?.toString()) ||
      appointment.sellerId?.toString();
    const normalizedUserId = userId.toString();

    const isBuyer = buyerId === normalizedUserId;
    const isSeller = sellerId === normalizedUserId;
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';

    if (!isBuyer && !isSeller && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thao tác lịch hẹn này'
      });
    }

    const appointmentIdStr = (appointment as any)?._id?.toString?.();

    if (isBuyer) {
      const nowChoice = new Date();
      appointment.buyerSlotChoice = slotDate;
      appointment.buyerConfirmed = true;
      appointment.buyerConfirmedAt = nowChoice;
    } else if (isSeller) {
      const nowChoice = new Date();
      appointment.sellerSlotChoice = slotDate;
      appointment.sellerConfirmed = true;
      appointment.sellerConfirmedAt = nowChoice;
    } else if (isStaff) {
      const nowChoice = new Date();
      appointment.buyerSlotChoice = slotDate;
      appointment.sellerSlotChoice = slotDate;
      appointment.buyerConfirmed = true;
      appointment.sellerConfirmed = true;
      appointment.buyerConfirmedAt = nowChoice;
      appointment.sellerConfirmedAt = nowChoice;
    }

    let slotFinalized = false;
    let message = 'Đã ghi nhận lựa chọn, đang chờ bên còn lại xác nhận';

    if (
      appointment.buyerSlotChoice &&
      appointment.sellerSlotChoice &&
      appointment.buyerSlotChoice.getTime() === appointment.sellerSlotChoice.getTime()
    ) {
      const now = new Date();
      slotFinalized = true;
      appointment.selectedSlot = appointment.buyerSlotChoice;
      appointment.scheduledDate = appointment.selectedSlot;
      appointment.status = 'CONFIRMED';
      appointment.buyerConfirmed = true;
      appointment.sellerConfirmed = true;
      appointment.buyerConfirmedAt = now;
      appointment.sellerConfirmedAt = now;
      appointment.confirmedAt = now;
      // Phân biệt message và step cập nhật theo loại appointment
      if (appointment.type === 'CONTRACT_NOTARIZATION') {
        message = 'Đã chốt lịch công chứng';

        if (appointment.dealId && appointmentIdStr) {
          try {
            await dealService.updatePaperworkStep(appointment.dealId, 'NOTARIZATION', {
              status: 'IN_PROGRESS',
              note: 'Hai bên đã xác nhận lịch công chứng',
              appointmentId: appointmentIdStr
            });
          } catch (err) {
            console.error('Error updating deal paperwork after slot confirmation:', err);
          }

          try {
            await dealService.updateAppointmentMilestone(appointment.dealId, 'notarization', {
              appointmentId: appointmentIdStr,
              status: 'SCHEDULED',
              scheduledAt: appointment.selectedSlot,
            });
          } catch (err) {
            console.error('Error updating deal milestone after slot confirmation:', err);
          }

          // Cập nhật Contract timeline
          try {
            const deal = await dealService.getDealById(appointment.dealId);
            if (deal?.contractId) {
              const contract: any = await Contract.findById(deal.contractId);
              if (contract) {
                if (!contract.paperworkTimeline || contract.paperworkTimeline.length === 0) {
                  contract.paperworkTimeline = buildDefaultTimeline(
                    contract.contractType || "DEPOSIT"
                  ) as any;
                }
                const notarizationStep = contract.paperworkTimeline.find(
                  (step: any) => step.step === "NOTARIZATION"
                );
                if (notarizationStep) {
                  const notarizationStepAny: any = notarizationStep;
                  notarizationStepAny.status = "IN_PROGRESS";
                  notarizationStepAny.note = "Hai bên đã xác nhận lịch công chứng";
                  notarizationStepAny.updatedAt = new Date();
                  notarizationStepAny.updatedBy = userId?.toString();
                  contract.markModified("paperworkTimeline");
                  await contract.save();
                }
              }
            }
          } catch (contractErr) {
            console.error('Error updating contract timeline after slot confirmation:', contractErr);
          }
        }
      } else if (appointment.type === 'VEHICLE_HANDOVER') {
        message = 'Đã chốt lịch bàn giao xe';

        if (appointment.dealId && appointmentIdStr) {
          try {
            await dealService.updatePaperworkStep(appointment.dealId, 'HANDOVER_PAPERS_AND_CAR', {
              status: 'IN_PROGRESS',
              note: 'Hai bên đã xác nhận lịch bàn giao xe',
              appointmentId: appointmentIdStr
            });
          } catch (err) {
            console.error('Error updating deal paperwork after handover slot confirmation:', err);
          }

          try {
            await dealService.updateAppointmentMilestone(appointment.dealId, 'handover', {
              appointmentId: appointmentIdStr,
              status: 'SCHEDULED',
              scheduledAt: appointment.selectedSlot,
            });
          } catch (err) {
            console.error('Error updating deal milestone after handover slot confirmation:', err);
          }

          // Cập nhật Contract timeline
          try {
            const deal = await dealService.getDealById(appointment.dealId);
            if (deal?.contractId) {
              const contract: any = await Contract.findById(deal.contractId);
              if (contract) {
                if (!contract.paperworkTimeline || contract.paperworkTimeline.length === 0) {
                  contract.paperworkTimeline = buildDefaultTimeline(
                    contract.contractType || "DEPOSIT"
                  ) as any;
                }
                const handoverStep = contract.paperworkTimeline.find(
                  (step: any) => step.step === "HANDOVER_PAPERS_AND_CAR"
                );
                if (handoverStep) {
                  const handoverStepAny: any = handoverStep;
                  handoverStepAny.status = "IN_PROGRESS";
                  handoverStepAny.note = "Hai bên đã xác nhận lịch bàn giao xe";
                  handoverStepAny.updatedAt = new Date();
                  handoverStepAny.updatedBy = userId?.toString();
                  contract.markModified("paperworkTimeline");
                  await contract.save();
                }
              }
            }
          } catch (contractErr) {
            console.error('Error updating contract timeline after handover slot confirmation:', contractErr);
          }
        }
      }

      if (buyerId && sellerId) {
        try {
          await emailService.sendAppointmentConfirmedNotification(
            buyerId,
            sellerId,
            appointment
          );
        } catch (emailError) {
          console.error(
            'Error sending notarization confirmation email:',
            emailError
          );
        }
      }
    }

    await appointment.save();

    res.json({
      success: true,
      message,
      slotFinalized,
      appointment: {
        id: appointmentIdStr || appointment._id,
        status: appointment.status,
        selectedSlot: appointment.selectedSlot,
        buyerSlotChoice: appointment.buyerSlotChoice,
        sellerSlotChoice: appointment.sellerSlotChoice
      }
    });
  } catch (error) {
    console.error('Error selecting appointment slot:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const declineNotarizationAppointment = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const { appointmentId } = req.params;
    const { reason } = req.body || {};

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    const buyerId =
      (appointment.buyerId && (appointment.buyerId as any)._id?.toString()) ||
      appointment.buyerId?.toString();
    const sellerId =
      (appointment.sellerId && (appointment.sellerId as any)._id?.toString()) ||
      appointment.sellerId?.toString();
    const normalizedUserId = userId.toString();
    const isBuyer = buyerId === normalizedUserId;
    const isSeller = sellerId === normalizedUserId;
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';

    if (!isBuyer && !isSeller && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thao tác lịch hẹn này'
      });
    }

    const appointmentIdStr = (appointment as any)?._id?.toString?.();

    appointment.status = 'REJECTED' as any;
    appointment.selectedSlot = undefined;
    if (isBuyer) {
      appointment.buyerSlotChoice = undefined;
    }
    if (isSeller) {
      appointment.sellerSlotChoice = undefined;
    }
    appointment.notes = reason ? `${appointment.notes ? `${appointment.notes}\n` : ''}${reason}` : appointment.notes;

    if (appointment.dealId && appointmentIdStr) {
      try {
        await dealService.updatePaperworkStep(appointment.dealId, 'NOTARIZATION', {
          status: 'BLOCKED',
          note: reason || 'Buyer/Seller không thể tham gia lịch công chứng',
          appointmentId: appointmentIdStr
        });
      } catch (err) {
        console.error('Error updating deal paperwork after decline:', err);
      }

      try {
        await dealService.updateAppointmentMilestone(appointment.dealId, 'notarization', {
          appointmentId: appointmentIdStr,
          status: 'NOT_SCHEDULED',
        });
      } catch (err) {
        console.error('Error updating deal milestone after decline:', err);
      }
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Đã thông báo không thể tham gia. Nhân viên sẽ liên hệ lại để sắp xếp lịch mới.',
      appointment: {
        id: appointmentIdStr || appointment._id,
        status: appointment.status
      }
    });
  } catch (error) {
    console.error('Error declining appointment slot:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const uploadNotarizationProof = async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.user || !["staff", "admin"].includes(req.user.role ?? "")) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền upload bằng chứng công chứng",
      });
    }

    const { appointmentId } = req.params;
    const { note } = req.body as { note?: string };
    const userId = req.user.id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    const normalizedDealId =
      typeof appointment.dealId === "string"
        ? appointment.dealId
        : (appointment.dealId as any)?.toString?.();
    const dealDoc = normalizedDealId
      ? await dealService.getDealById(normalizedDealId)
      : null;

    if (appointment.type !== "CONTRACT_NOTARIZATION") {
      return res.status(400).json({
        success: false,
        message: "Chỉ áp dụng cho lịch công chứng",
      });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất 1 ảnh bằng chứng",
      });
    }

    const uploadedProofs: {
      url: string;
      publicId?: string;
      description?: string;
      uploadedAt: Date;
      uploadedBy?: string;
    }[] = [];

    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
        continue;
      }

      const uploadResult = await uploadFromBuffer(
        file.buffer,
        `notarization-proof-${appointmentId}-${Date.now()}`,
        {
          folder: "secondhand-ev/notarization/proofs",
          resource_type: "image",
        }
      );

      uploadedProofs.push({
        url: uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        description: note || file.originalname || "Ảnh bằng chứng công chứng",
        uploadedAt: new Date(),
        uploadedBy: userId,
      });
    }

    if (uploadedProofs.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Không thể upload ảnh nào",
      });
    }

    appointment.notarizationProofs = [
      ...(appointment.notarizationProofs || []),
      ...uploadedProofs,
    ];
    appointment.status = "COMPLETED";
    appointment.completedAt = new Date();
    appointment.completedByStaffId = userId;
    appointment.completedByStaffName = req.user.name || req.user.email;
    appointment.completedByStaffEmail = req.user.email;

    const appointmentIdStr = (appointment as any)?._id?.toString?.();

    if (appointment.dealId && appointmentIdStr) {
      try {
        await dealService.updatePaperworkStep(appointment.dealId, "NOTARIZATION", {
          status: "DONE",
          note: note || "Đã hoàn tất công chứng",
          appointmentId: appointmentIdStr,
          attachments: uploadedProofs.map((proof) => ({
            url: proof.url,
            description: proof.description,
            uploadedAt: proof.uploadedAt,
          })),
        });
      } catch (err) {
        console.error("Error updating deal paperwork after notarization proof:", err);
      }

      try {
        await dealService.updateAppointmentMilestone(appointment.dealId, "notarization", {
          appointmentId: appointmentIdStr,
          status: "COMPLETED",
          completedAt: new Date(),
        });
      } catch (err) {
        console.error(
          "Error updating deal milestone after notarization proof:",
          err
        );
      }
    }

    try {
      const contract =
        (await Contract.findOne({ appointmentId: appointment._id })) ||
        (appointment.dealId
          ? await Contract.findOne({ dealId: appointment.dealId })
          : null);

      if (contract) {
        if (!contract.paperworkTimeline || contract.paperworkTimeline.length === 0) {
          contract.paperworkTimeline = buildDefaultTimeline(
            contract.contractType || "DEPOSIT"
          ) as any;
        }

        const notarizationStep = contract.paperworkTimeline.find(
          (step: any) => step.step === "NOTARIZATION"
        );

        if (notarizationStep) {
          const notarizationStepAny: any = notarizationStep;
          notarizationStepAny.status = "DONE";
          notarizationStepAny.updatedAt = new Date();
          notarizationStepAny.updatedBy = userId;
          notarizationStepAny.note = note || notarizationStepAny.note;
          notarizationStepAny.appointmentRequired = true;
          notarizationStepAny.appointmentId = appointmentIdStr;
          notarizationStepAny.attachments = [
            ...(notarizationStepAny.attachments || []),
            ...uploadedProofs.map((proof) => ({
              url: proof.url,
              publicId: proof.publicId ?? "",
              description: proof.description,
              uploadedAt: proof.uploadedAt,
              uploadedBy: userId ?? "staff",
            })),
          ];
        }

        contract.markModified("paperworkTimeline");
        await contract.save();
      }
    } catch (contractError) {
      console.error(
        "Error updating contract timeline after notarization proof:",
        contractError
      );
    }

    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Đã upload bằng chứng công chứng thành công",
      data: {
        appointmentId: appointmentIdStr || appointment._id,
        proofs: uploadedProofs.map((proof) => ({
          url: proof.url,
          description: proof.description,
          uploadedAt: proof.uploadedAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error uploading notarization proof:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi upload bằng chứng công chứng",
      error: error?.message || "Unknown error",
    });
  }
};

export const uploadHandoverProof = async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.user || !["staff", "admin"].includes(req.user.role ?? "")) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền upload bằng chứng bàn giao xe",
      });
    }

    const { appointmentId } = req.params;
    const { note } = req.body as { note?: string };
    const userId = req.user.id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    const normalizedDealId =
      typeof appointment.dealId === "string"
        ? appointment.dealId
        : (appointment.dealId as any)?.toString?.();
    const dealDoc = normalizedDealId
      ? await dealService.getDealById(normalizedDealId)
      : null;

    if (
      appointment.type !== "VEHICLE_HANDOVER" &&
      appointment.type !== "DELIVERY"
    ) {
      return res.status(400).json({
        success: false,
        message: "Chỉ áp dụng cho lịch bàn giao xe",
      });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất 1 ảnh bằng chứng",
      });
    }

    const uploadedProofs: {
      url: string;
      publicId?: string;
      description?: string;
      uploadedAt: Date;
      uploadedBy?: string;
    }[] = [];

    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
        continue;
      }

      const uploadResult = await uploadFromBuffer(
        file.buffer,
        `handover-proof-${appointmentId}-${Date.now()}`,
        {
          folder: "secondhand-ev/handover/proofs",
          resource_type: "image",
        }
      );

      uploadedProofs.push({
        url: uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        description: note || file.originalname || "Ảnh bàn giao xe",
        uploadedAt: new Date(),
        uploadedBy: userId,
      });
    }

    if (uploadedProofs.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Không thể upload ảnh nào",
      });
    }

    const appointmentAny = appointment as any;
    appointmentAny.handoverProofs = [
      ...(appointmentAny.handoverProofs || []),
      ...uploadedProofs,
    ];
    appointment.status = "COMPLETED";
    appointment.completedAt = new Date();
    appointment.completedByStaffId = userId;
    appointment.completedByStaffName = req.user.name || req.user.email;
    appointment.completedByStaffEmail = req.user.email;

    const appointmentIdStr = (appointment as any)?._id?.toString?.();

    if (appointment.dealId && appointmentIdStr) {
      let payoutAmount: number | undefined;
      const vehiclePrice = dealDoc?.paymentPlan?.vehiclePrice;
      if (vehiclePrice && vehiclePrice > 0) {
        payoutAmount = Math.round(vehiclePrice * 0.9);
        const sellerIdStr =
          ((appointment.sellerId as any)?._id?.toString?.() ||
            (appointment.sellerId as any)?.toString?.()) ??
          appointment.sellerId?.toString();

        if (sellerIdStr) {
          try {
            await systemWalletService.withdraw(
              payoutAmount,
              `Thanh toán 90% giá xe cho người bán ${sellerIdStr} (deal ${appointment.dealId})`
            );
            await walletService.deposit(
              sellerIdStr,
              payoutAmount,
              "Thanh toán 90% giá trị xe sau bàn giao"
            );
          } catch (transferError) {
            console.error(
              "Error transferring payout to seller wallet:",
              transferError
            );
          }
        }
      }

      try {
        await dealService.updatePaperworkStep(appointment.dealId, "HANDOVER_PAPERS_AND_CAR", {
          status: "DONE",
          note: note || "Đã hoàn tất bàn giao xe",
          appointmentId: appointmentIdStr,
          attachments: uploadedProofs.map((proof) => ({
            url: proof.url,
            description: proof.description,
            uploadedAt: proof.uploadedAt,
          })),
        });
      } catch (err) {
        console.error("Error updating deal paperwork after handover proof:", err);
      }

      try {
        await dealService.updateAppointmentMilestone(appointment.dealId, "handover", {
          appointmentId: appointmentIdStr,
          status: "COMPLETED",
          completedAt: new Date(),
        });
      } catch (err) {
        console.error("Error updating deal milestone after handover proof:", err);
      }

      try {
        await dealService.releasePayout(appointment.dealId, {
          amount: payoutAmount,
          releasedBy: userId,
          note:
            note ||
            (payoutAmount
              ? `Tự động trả ${payoutAmount.toLocaleString("vi-VN")} VND (90% giá xe) sau bàn giao`
              : "Tự động trả tiền sau bàn giao"),
        });
      } catch (payoutError) {
        console.error("Error releasing payout after handover:", payoutError);
      }
    }

    try {
      const contract =
        (await Contract.findOne({ appointmentId: appointment._id })) ||
        (appointment.dealId
          ? await Contract.findOne({ dealId: appointment.dealId })
          : null);

      if (contract) {
        if (!contract.paperworkTimeline || contract.paperworkTimeline.length === 0) {
          contract.paperworkTimeline = buildDefaultTimeline(
            contract.contractType || "DEPOSIT"
          ) as any;
        }

        const handoverStep = contract.paperworkTimeline.find(
          (step: any) => step.step === "HANDOVER_PAPERS_AND_CAR"
        );

        if (handoverStep) {
          const handoverStepAny: any = handoverStep;
          handoverStepAny.status = "DONE";
          handoverStepAny.updatedAt = new Date();
          handoverStepAny.updatedBy = userId;
          handoverStepAny.note = note || handoverStepAny.note;
          handoverStepAny.attachments = [
            ...(handoverStepAny.attachments || []),
            ...uploadedProofs.map((proof) => ({
              url: proof.url,
              publicId: proof.publicId ?? "",
              description: proof.description,
              uploadedAt: proof.uploadedAt,
              uploadedBy: userId ?? "staff",
            })),
          ];
        }

        contract.markModified("paperworkTimeline");
        await contract.save();
      }
    } catch (contractError) {
      console.error("Error updating contract timeline after handover proof:", contractError);
    }

    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Đã upload bằng chứng bàn giao xe thành công",
      data: {
        appointmentId: appointmentIdStr || appointment._id,
        proofs: uploadedProofs.map((proof) => ({
          url: proof.url,
          description: proof.description,
          uploadedAt: proof.uploadedAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error uploading handover proof:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi upload bằng chứng bàn giao xe",
      error: error?.message || "Unknown error",
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
    if (
      appointment.status !== 'PENDING' &&
      appointment.status !== 'CONFIRMED' &&
      appointment.status !== 'RESCHEDULED' &&
      appointment.status !== 'PENDING_CONFIRMATION'
    ) {
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
    let refundAmount = 0;
    
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
      refundAmount = depositRequest.depositAmount;
    }
    
    // ✅ Nếu là AUCTION appointment -> Xử lý hoàn tiền cọc đấu giá (50%)
    if (appointment.appointmentType === 'AUCTION' && appointment.auctionId) {
      try {
        const AuctionDeposit = (await import('../models/AuctionDeposit')).default;
        const auctionDepositService = (await import('../services/auctionDepositService')).default;
        
        // Tìm deposit của winner trong auction
        const auctionDeposit = await AuctionDeposit.findOne({
          auctionId: appointment.auctionId,
          userId: appointment.buyerId,
          status: 'FROZEN'
        });

        if (auctionDeposit) {
          const fullDepositAmount = auctionDeposit.depositAmount;
          const refundPercentage = 0.5; // 50%
          const refundAmountAuction = Math.floor(fullDepositAmount * refundPercentage);
          const penaltyAmount = fullDepositAmount - refundAmountAuction; // 50% penalty

          // Hoàn 50% tiền cọc về ví winner
          const winnerWallet = await walletService.getWallet(appointment.buyerId.toString());
          
          // Giảm frozenAmount
          if (winnerWallet.frozenAmount >= fullDepositAmount) {
            winnerWallet.frozenAmount -= fullDepositAmount;
          } else {
            winnerWallet.frozenAmount = 0;
          }
          
          // Cộng 50% vào balance
          winnerWallet.balance += refundAmountAuction;
          winnerWallet.lastTransactionAt = new Date();
          await winnerWallet.save();

          // Cập nhật deposit status
          auctionDeposit.status = 'REFUNDED';
          auctionDeposit.refundedAt = new Date();
          await auctionDeposit.save();

          // 50% còn lại vào system wallet
          const SystemWallet = (await import('../models/SystemWallet')).default;
          let systemWallet = await SystemWallet.findOne();
          if (!systemWallet) {
            systemWallet = await SystemWallet.create({
              balance: penaltyAmount,
              totalEarned: penaltyAmount,
              totalTransactions: 1,
              lastTransactionAt: new Date()
            });
          } else {
            systemWallet.balance += penaltyAmount;
            systemWallet.totalEarned += penaltyAmount;
            systemWallet.totalTransactions += 1;
            systemWallet.lastTransactionAt = new Date();
            await systemWallet.save();
          }

          // Cập nhật listing về Published
          const auction = await (await import('../models/Auction')).default.findById(appointment.auctionId).populate('listingId');
          if (auction) {
            const listing = auction.listingId as any;
            if (listing) {
              await Listing.findByIdAndUpdate(listing._id, { status: 'Published' });
            }
          }

          isTransactionCancelled = true;
          refundAmount = refundAmountAuction;

          console.log(`[cancelAppointment] Auction deposit refund: 50% (${refundAmountAuction.toLocaleString('vi-VN')}₫) returned, 50% (${penaltyAmount.toLocaleString('vi-VN')}₫) penalty to system`);
        }
      } catch (auctionError) {
        console.error('[cancelAppointment] Error processing auction deposit refund:', auctionError);
      }
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
        ? (appointment.appointmentType === 'AUCTION' 
            ? `Đã hủy lịch hẹn thành công. Hoàn lại 50% tiền cọc (${refundAmount.toLocaleString('vi-VN')}₫), 50% còn lại bị phạt`
            : 'Đã hủy giao dịch thành công, tiền đã hoàn về ví của bạn')
        : 'Hủy lịch hẹn thành công',
      appointment: {
        id: appointment._id,
        status: appointment.status,
        cancelledAt: appointment.cancelledAt
      },
      refunded: isTransactionCancelled,
      refundAmount: refundAmount,
      isAuction: appointment.appointmentType === 'AUCTION'
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

// Staff xác nhận buổi xem xe đã hoàn thành
export const completeAppointment = async (req: Request, res: Response): Promise<any> => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập',
      });
    }

    const isStaff = userRole === 'staff' || userRole === 'admin';
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ nhân viên hoặc admin mới có quyền xác nhận hoàn thành lịch hẹn',
      });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('buyerId', 'fullName email phone')
      .populate('sellerId', 'fullName email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn',
      });
    }

    if (appointment.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể hoàn thành lịch hẹn đã được xác nhận',
      });
    }

    

    const staff = await User.findById(userId).select('fullName email phone');

    appointment.status = 'COMPLETED' as any;
    appointment.completedAt = new Date();
    appointment.completedByStaffId = userId;
    appointment.completedByStaffName =
      staff?.fullName || (req.user as any)?.fullName || 'N/A';
    appointment.completedByStaffEmail = staff?.email || (req.user as any)?.email;
    appointment.completedByStaffPhone = staff?.phone || undefined;
    await appointment.save();

    return res.json({
      success: true,
      message: 'Đã đánh dấu buổi xem xe hoàn thành',
      appointment: {
        id: appointment._id,
        status: appointment.status,
        completedAt: appointment.completedAt,
        completedByStaff: appointment.completedByStaffId
          ? {
              id: appointment.completedByStaffId,
              name: appointment.completedByStaffName,
              email: appointment.completedByStaffEmail,
              phone: appointment.completedByStaffPhone,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error completing appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error',
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

// Lấy appointment active của một chat (nếu có)
export const getAppointmentByChatId = async (req: Request, res: Response): Promise<any> => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập',
      });
    }

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu chatId',
      });
    }

    // Tìm appointment active của chat này
    const appointment = await Appointment.findOne({
      chatId,
      status: { $in: ['PENDING', 'PENDING_CONFIRMATION', 'CONFIRMED',  'RESCHEDULED'] },
    })
      .populate('buyerId', 'fullName email phone avatar')
      .populate('sellerId', 'fullName email phone avatar')
      .populate('listingId', 'make model year priceListed photos')
      .sort({ createdAt: -1 }); // Lấy appointment mới nhất nếu có nhiều

    if (!appointment) {
      return res.json({
        success: true,
        data: null,
        hasActiveAppointment: false,
      });
    }

    // Kiểm tra quyền xem (chỉ người mua hoặc người bán)
    const buyerId =
      (appointment.buyerId && (appointment.buyerId as any)._id?.toString()) ||
      appointment.buyerId?.toString();
    const sellerId =
      (appointment.sellerId && (appointment.sellerId as any)._id?.toString()) ||
      appointment.sellerId?.toString();

    if (buyerId !== userId && sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem lịch hẹn này',
      });
    }

    res.json({
      success: true,
      data: appointment,
      hasActiveAppointment: true,
    });
  } catch (error) {
    console.error('Error getting appointment by chatId:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error',
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
      .populate(
        'listingId',
        'title brand make model year priceListed licensePlate engineDisplacementCc vehicleType paintColor engineNumber chassisNumber otherFeatures'
      )
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
      .select('appointmentId contractPhotos status _id staffId staffName');
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
      let listingFromAppointment = appointment.listingId as any;
      let listing, depositAmount, depositStatus, vehiclePrice;
      
      if (isAuction) {
        // Từ auction
        const auction = appointment.auctionId as any;
        listing = auction?.listingId || listingFromAppointment;
        depositAmount = 1000000; // Phí tham gia đấu giá
        depositStatus = 'N/A';
        vehiclePrice =
          auction?.winningBid?.price ||
          auction?.startingPrice ||
          listing?.priceListed ||
          0;
      } else {
        // Từ deposit thông thường
        const depositRequest = appointment.depositRequestId as any;
        listing = depositRequest?.listingId || listingFromAppointment;
        depositAmount = depositRequest?.depositAmount || 0;
        depositStatus = depositRequest?.status || 'N/A';
        vehiclePrice = depositRequest?.vehiclePrice || listing?.priceListed || 0;
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
      
      // ✅ Thông tin staff xử lý giao dịch
      staff: contract?.staffId ? {
        id: contract.staffId,
        name: contract.staffName || 'N/A'
      } : null,
      completionStaff: appointment.completedByStaffId
        ? {
            id: appointment.completedByStaffId,
            name: appointment.completedByStaffName || 'N/A',
            email: appointment.completedByStaffEmail || 'N/A',
            phone: appointment.completedByStaffPhone || 'N/A',
          }
        : null,
      completedAt: appointment.completedAt,
      
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
