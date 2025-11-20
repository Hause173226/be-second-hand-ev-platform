import cron from "node-cron";
import Appointment from "../models/Appointment";
import Listing from "../models/Listing";
import { User } from "../models/User";
import walletService from "../services/walletService";
import systemWalletService from "../services/systemWalletService";
import emailService from "../services/emailService";
import NotificationMessage from "../models/NotificationMessage";
import { Types } from "mongoose";
import { WebSocketService } from "../services/websocketService";

// Deadline: 7 ngày sau khi đặt cọc 10%
const REMAINING_PAYMENT_DEADLINE_DAYS = 7;
const REMINDER_HOURS_BEFORE_DEADLINE = 48;

/**
 * Cron job kiểm tra appointments quá hạn thanh toán phần còn lại
 * Chạy mỗi giờ để kiểm tra
 */
export const startRemainingPaymentCron = () => {
  // Chạy mỗi giờ
  cron.schedule("0 * * * *", async () => {
    console.log("🔄 [CRON] Running remaining payment deadline check...");
    try {
      await checkRemainingPaymentDeadlines();
    } catch (error) {
      console.error("❌ [CRON] Remaining payment deadline check error:", error);
    }
  });

  console.log("✅ Remaining payment cron job started");
};

/**
 * Kiểm tra và xử lý appointments quá hạn thanh toán phần còn lại
 */
async function checkRemainingPaymentDeadlines() {
  const now = new Date();

  // Tìm tất cả appointments đang chờ thanh toán phần còn lại
  const appointments = await Appointment.find({
    status: "AWAITING_REMAINING_PAYMENT",
    "timeline.depositPaidAt": { $exists: true, $ne: null },
  })
    .populate("buyerId", "email fullName")
    .populate("sellerId", "email fullName");

  console.log(
    `📋 [CRON] Found ${appointments.length} appointments awaiting remaining payment`
  );

  for (const appointment of appointments) {
    const depositPaidAt = appointment.timeline?.depositPaidAt;
    if (!depositPaidAt) continue;

    const deadline = new Date(depositPaidAt);
    deadline.setDate(deadline.getDate() + REMAINING_PAYMENT_DEADLINE_DAYS);

    const hoursUntilDeadline =
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Kiểm tra xem đã gửi email nhắc nhở chưa
    const reminderSent =
      appointment.timeline?.remainingPaymentReminderSent || false;

    // Nếu còn 48h trước deadline và chưa gửi nhắc nhở
    if (
      hoursUntilDeadline <= REMINDER_HOURS_BEFORE_DEADLINE &&
      hoursUntilDeadline > 0 &&
      !reminderSent
    ) {
      await sendRemainingPaymentReminder(appointment);
    }

    // Nếu đã quá hạn
    if (hoursUntilDeadline <= 0) {
      await processOverdueRemainingPayment(appointment);
    }
  }
}

/**
 * Gửi email nhắc nhở thanh toán phần còn lại (48h trước deadline)
 */
async function sendRemainingPaymentReminder(appointment: any) {
  try {
    const buyer = await User.findById(appointment.buyerId);
    if (!buyer || !buyer.email) {
      console.log(
        `⚠️ [Reminder] Buyer not found or no email for appointment ${appointment._id}`
      );
      return;
    }

    const depositPaidAt = appointment.timeline?.depositPaidAt;
    if (!depositPaidAt) return;

    const deadline = new Date(depositPaidAt);
    deadline.setDate(deadline.getDate() + REMAINING_PAYMENT_DEADLINE_DAYS);

    const deadlineFormatted = deadline.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Lấy thông tin listing để hiển thị
    let listingInfo = "";
    if (appointment.listingId) {
      const listing = await Listing.findById(appointment.listingId);
      if (listing) {
        listingInfo = `${listing.make} ${listing.model} ${listing.year}`;
      }
    }

    // Gửi email
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
          <h2 style="color: #856404; margin-top: 0;">⏰ Nhắc nhở thanh toán phần còn lại</h2>
          <p style="font-size: 16px; margin-bottom: 0;">Chào ${
            buyer.fullName || buyer.email
          },</p>
        </div>
        
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
          <p style="font-size: 16px; line-height: 1.6;">
            Bạn còn <strong>48 giờ</strong> để thanh toán phần còn lại (90% giá trị) cho giao dịch.
          </p>
          
          ${listingInfo ? `<p><strong>Xe:</strong> ${listingInfo}</p>` : ""}
          
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="color: #495057; margin-top: 0;">📋 Thông tin:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Mã appointment:</strong> ${appointment._id}</li>
              <li><strong>Hạn chót thanh toán:</strong> ${deadlineFormatted}</li>
              <li><strong>Trạng thái:</strong> Đang chờ thanh toán phần còn lại</li>
            </ul>
          </div>
          
          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">⚠️ Lưu ý quan trọng:</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.5;">
              Nếu bạn không thanh toán trước hạn chót, hệ thống sẽ tự động xử lý theo quy định:
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Bạn sẽ nhận lại 50% số tiền đặt cọc</li>
                <li>Người bán nhận 30% số tiền đặt cọc</li>
                <li>Hệ thống giữ lại 20% số tiền đặt cọc (tối đa 10 triệu VNĐ)</li>
              </ul>
            </p>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${
              process.env.FRONTEND_URL || "http://localhost:5173"
            }/appointments/${appointment._id}" 
               style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Thanh toán ngay
            </a>
          </div>
        </div>
      </div>
    `;

    await emailService.sendEmail(
      buyer.email,
      "⏰ Nhắc nhở: Còn 48 giờ để thanh toán phần còn lại",
      emailContent
    );

    // Cập nhật flag đã gửi nhắc nhở
    if (!appointment.timeline) {
      appointment.timeline = {};
    }
    appointment.timeline.remainingPaymentReminderSent = true;
    await appointment.save();

    // Gửi notification
    try {
      const notification = await NotificationMessage.create({
        userId: new Types.ObjectId(appointment.buyerId),
        type: "appointment",
        title: "⏰ Nhắc nhở thanh toán phần còn lại",
        message: `Bạn còn 48 giờ để thanh toán phần còn lại. Hạn chót: ${deadlineFormatted}`,
        relatedId: new Types.ObjectId(appointment._id),
        isRead: false,
        isDeleted: false,
        actionUrl: `/appointments/${appointment._id}`,
        actionText: "Thanh toán ngay",
        metadata: {
          appointmentId: appointment._id.toString(),
          deadline: deadline.toISOString(),
          type: "remaining_payment_reminder",
        },
      });

      // Gửi real-time notification qua WebSocket
      try {
        const wsService = WebSocketService.getInstance();
        wsService.sendToUser(
          appointment.buyerId.toString(),
          "new_notification",
          {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            actionUrl: notification.actionUrl,
            actionText: notification.actionText,
            metadata: notification.metadata,
            createdAt: notification.createdAt,
            isRead: false,
          }
        );
      } catch (wsError) {
        console.log(
          "⚠️ WebSocket not available, notification saved to DB only"
        );
      }

      console.log(
        `✅ [Reminder] Sent reminder email and notification to buyer ${appointment.buyerId} for appointment ${appointment._id}`
      );
    } catch (notifError: any) {
      console.error(
        `❌ [Reminder] Failed to create notification:`,
        notifError.message
      );
    }
  } catch (error: any) {
    console.error(
      `❌ [Reminder] Error sending reminder for appointment ${appointment._id}:`,
      error.message
    );
  }
}

/**
 * Xử lý thanh toán phần còn lại quá hạn
 * Chia tiền: 50% buyer, 30% seller, 20% system (max 10tr)
 */
async function processOverdueRemainingPayment(appointment: any) {
  try {
    // Kiểm tra xem đã xử lý chưa
    if (appointment.status !== "AWAITING_REMAINING_PAYMENT") {
      return; // Đã xử lý rồi
    }

    // Lấy thông tin deposit request để tính tiền đặt cọc
    const DepositRequest = (await import("../models/DepositRequest")).default;
    let depositAmount = 0;

    if (appointment.depositRequestId) {
      const depositRequest = await DepositRequest.findById(
        appointment.depositRequestId.toString().replace(/,/g, "")
      );
      if (depositRequest) {
        depositAmount = depositRequest.depositAmount;
      }
    }

    // Nếu không có depositRequest, tính từ listing
    if (depositAmount === 0 && appointment.listingId) {
      const listing = await Listing.findById(appointment.listingId);
      if (listing) {
        depositAmount = Math.round(listing.priceListed * 0.1); // 10% giá xe
      }
    }

    if (depositAmount === 0) {
      console.error(
        `❌ [Overdue] Cannot calculate deposit amount for appointment ${appointment._id}`
      );
      return;
    }

    // Tính toán phân chia tiền
    const buyerRefundBase = Math.round(depositAmount * 0.5); // 50% cho buyer
    const sellerShare = Math.round(depositAmount * 0.3); // 30% cho seller
    let systemShare = Math.round(depositAmount * 0.2); // 20% cho system
    const MAX_SYSTEM_SHARE = 10000000; // 10 triệu VNĐ

    // Nếu system share vượt quá 10tr, giới hạn lại và phần còn lại về buyer
    let buyerRefund = buyerRefundBase;
    if (systemShare > MAX_SYSTEM_SHARE) {
      const excess = systemShare - MAX_SYSTEM_SHARE;
      systemShare = MAX_SYSTEM_SHARE;
      buyerRefund += excess; // Phần vượt quá về buyer
    }

    console.log(
      `💰 [Overdue] Processing overdue payment for appointment ${appointment._id}:`
    );
    console.log(
      `   Deposit amount: ${depositAmount.toLocaleString("vi-VN")} VND`
    );
    console.log(
      `   Buyer refund (50%): ${buyerRefund.toLocaleString("vi-VN")} VND`
    );
    console.log(
      `   Seller share (30%): ${sellerShare.toLocaleString("vi-VN")} VND`
    );
    console.log(
      `   System share (20%, max 10tr): ${systemShare.toLocaleString(
        "vi-VN"
      )} VND`
    );

    // 1. Hoàn 50% về ví buyer
    const buyerWallet = await walletService.getWallet(appointment.buyerId);
    buyerWallet.balance += buyerRefund;
    buyerWallet.lastTransactionAt = new Date();
    await buyerWallet.save();

    // 2. Chuyển 30% cho seller
    const sellerWallet = await walletService.getWallet(appointment.sellerId);
    sellerWallet.balance += sellerShare;
    sellerWallet.lastTransactionAt = new Date();
    await sellerWallet.save();

    // 3. Chuyển 20% (max 10tr) vào system wallet
    await systemWalletService.deposit(
      systemShare,
      `Phí quá hạn thanh toán phần còn lại từ appointment ${appointment._id} (20% tiền đặt cọc, max 10tr)`,
      "CANCELLED",
      appointment.depositRequestId,
      appointment._id.toString()
    );

    // 4. Cập nhật appointment status
    appointment.status = "CANCELLED";
    appointment.cancelledAt = new Date();
    if (!appointment.timeline) {
      appointment.timeline = {};
    }
    appointment.timeline.overdueProcessedAt = new Date();
    await appointment.save();

    // 5. Cập nhật listing status về Published nếu đang InTransaction
    if (appointment.listingId) {
      try {
        const listing = await Listing.findById(appointment.listingId);
        if (listing && listing.status === "InTransaction") {
          listing.status = "Published";
          await listing.save();
          console.log(
            `✅ [Overdue] Updated listing ${appointment.listingId} status back to "Published"`
          );
        }
      } catch (listingError: any) {
        console.error(
          `❌ [Overdue] Error updating listing status:`,
          listingError.message
        );
      }
    }

    // 6. Gửi email và notification cho buyer
    const buyer = await User.findById(appointment.buyerId);
    if (buyer && buyer.email) {
      try {
        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
              <h2 style="color: #721c24; margin-top: 0;">⚠️ Thanh toán phần còn lại đã quá hạn</h2>
              <p style="font-size: 16px; margin-bottom: 0;">Chào ${
                buyer.fullName || buyer.email
              },</p>
            </div>
            
            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
              <p style="font-size: 16px; line-height: 1.6;">
                Giao dịch của bạn đã quá hạn thanh toán phần còn lại. Hệ thống đã tự động xử lý theo quy định.
              </p>
              
              <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3 style="color: #495057; margin-top: 0;">💰 Phân chia tiền đặt cọc:</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li><strong>Bạn nhận lại:</strong> ${buyerRefund.toLocaleString(
                    "vi-VN"
                  )} VND (50%)</li>
                  <li><strong>Người bán nhận:</strong> ${sellerShare.toLocaleString(
                    "vi-VN"
                  )} VND (30%)</li>
                  <li><strong>Hệ thống giữ lại:</strong> ${systemShare.toLocaleString(
                    "vi-VN"
                  )} VND (20%, tối đa 10 triệu)</li>
                </ul>
              </div>
              
              <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                  Số tiền ${buyerRefund.toLocaleString(
                    "vi-VN"
                  )} VND đã được hoàn vào ví của bạn.
                </p>
              </div>
            </div>
          </div>
        `;

        await emailService.sendEmail(
          buyer.email,
          "⚠️ Thanh toán phần còn lại đã quá hạn",
          emailContent
        );
      } catch (emailError: any) {
        console.error(
          `❌ [Overdue] Failed to send email to buyer:`,
          emailError.message
        );
      }
    }

    // Gửi notification cho buyer
    try {
      const buyerNotification = await NotificationMessage.create({
        userId: new Types.ObjectId(appointment.buyerId),
        type: "appointment",
        title: "⚠️ Thanh toán phần còn lại đã quá hạn",
        message: `Giao dịch đã quá hạn. Bạn nhận lại ${buyerRefund.toLocaleString(
          "vi-VN"
        )} VND (50% tiền đặt cọc).`,
        relatedId: new Types.ObjectId(appointment._id),
        isRead: false,
        isDeleted: false,
        actionUrl: `/appointments/${appointment._id}`,
        actionText: "Xem chi tiết",
        metadata: {
          appointmentId: appointment._id.toString(),
          refundAmount: buyerRefund,
          type: "overdue_remaining_payment",
        },
      });

      const wsService = WebSocketService.getInstance();
      wsService.sendToUser(appointment.buyerId.toString(), "new_notification", {
        _id: buyerNotification._id,
        type: buyerNotification.type,
        title: buyerNotification.title,
        message: buyerNotification.message,
        actionUrl: buyerNotification.actionUrl,
        actionText: buyerNotification.actionText,
        metadata: buyerNotification.metadata,
        createdAt: buyerNotification.createdAt,
        isRead: false,
      });
    } catch (notifError: any) {
      console.error(
        `❌ [Overdue] Failed to create buyer notification:`,
        notifError.message
      );
    }

    // Gửi notification cho seller
    try {
      const sellerNotification = await NotificationMessage.create({
        userId: new Types.ObjectId(appointment.sellerId),
        type: "appointment",
        title: "💰 Nhận bồi thường từ giao dịch quá hạn",
        message: `Bạn nhận được ${sellerShare.toLocaleString(
          "vi-VN"
        )} VND (30% tiền đặt cọc) do người mua không thanh toán phần còn lại đúng hạn.`,
        relatedId: new Types.ObjectId(appointment._id),
        isRead: false,
        isDeleted: false,
        actionUrl: `/appointments/${appointment._id}`,
        actionText: "Xem chi tiết",
        metadata: {
          appointmentId: appointment._id.toString(),
          amount: sellerShare,
          type: "overdue_penalty_received",
        },
      });

      const wsService = WebSocketService.getInstance();
      wsService.sendToUser(
        appointment.sellerId.toString(),
        "new_notification",
        {
          _id: sellerNotification._id,
          type: sellerNotification.type,
          title: sellerNotification.title,
          message: sellerNotification.message,
          actionUrl: sellerNotification.actionUrl,
          actionText: sellerNotification.actionText,
          metadata: sellerNotification.metadata,
          createdAt: sellerNotification.createdAt,
          isRead: false,
        }
      );
    } catch (notifError: any) {
      console.error(
        `❌ [Overdue] Failed to create seller notification:`,
        notifError.message
      );
    }

    console.log(
      `✅ [Overdue] Processed overdue payment for appointment ${appointment._id}`
    );
  } catch (error: any) {
    console.error(
      `❌ [Overdue] Error processing overdue payment for appointment ${appointment._id}:`,
      error.message
    );
  }
}
