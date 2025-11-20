import crypto from "crypto";
import querystring from "qs";
import moment from "moment";
import { Request } from "express";
import { VNPayConfig } from "../config/vnpay";
import Appointment from "../models/Appointment";
import DepositRequest from "../models/DepositRequest";
import Listing from "../models/Listing";
import PaymentTransaction from "../models/PaymentTransaction";
import { Payment } from "../models/Payment";
import systemWalletService from "./systemWalletService";
import emailService from "./emailService";
import { NotificationService } from "./notificationService";
import { User } from "../models/User";
import NotificationMessage from "../models/NotificationMessage";
import { Types } from "mongoose";
import { WebSocketService } from "./websocketService";

// Helper function để sort object (giống wallet service - đã hoạt động)
function sortObject(obj: any) {
  let sorted: any = {};
  let str = [];
  let key;
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

/**
 * Tạo VNPay URL cho đặt cọc 10% (dùng appointmentId)
 */
export const createDeposit10PaymentUrl = async (
  appointmentId: string,
  req: Request
) => {
  // Tìm Appointment
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    throw new Error("Appointment not found");
  }

  if (appointment.status !== "CONFIRMED") {
    throw new Error("Appointment must be CONFIRMED to create deposit");
  }

  // Lấy listingId từ appointment hoặc depositRequest
  let listingId: string | null = null;

  // Ưu tiên lấy từ appointment.listingId
  if (appointment.listingId) {
    listingId = appointment.listingId.toString().replace(/,/g, ""); // Remove trailing comma if any
  }
  // Nếu không có, thử lấy từ depositRequest
  else if (appointment.depositRequestId) {
    const depositRequest = await DepositRequest.findById(
      appointment.depositRequestId.toString().replace(/,/g, "")
    );
    if (depositRequest && depositRequest.listingId) {
      listingId = depositRequest.listingId.toString().replace(/,/g, "");
    }
  }

  if (!listingId) {
    throw new Error("Listing ID not found in appointment or depositRequest");
  }

  // Lấy Listing để lấy giá
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new Error("Listing not found");
  }

  const totalPrice = listing.priceListed;
  const depositAmount = Math.round(totalPrice * 0.1); // 10%

  process.env.TZ = "Asia/Ho_Chi_Minh";
  let date = new Date();
  let createDate = moment(date).format("YYYYMMDDHHmmss");

  let ipAddr: any =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "127.0.0.1";

  if (Array.isArray(ipAddr)) {
    ipAddr = ipAddr[0];
  }

  ipAddr = String(ipAddr).replace("::ffff:", "");
  if (ipAddr === "::1") {
    ipAddr = "127.0.0.1";
  }

  // Tạo orderId cho VNPay: format giống wallet service (đã hoạt động)
  // Format: appointmentIdShort_timestamp (giống userId_timestamp trong wallet)
  const appointmentIdShort = appointmentId.toString().slice(-12); // Lấy 12 ký tự cuối
  const timestamp = moment(date).format("DDHHmmss"); // Format giống wallet
  let vnpOrderId = `${appointmentIdShort}_${timestamp}`;
  let locale = "vn";
  let currCode = "VND";

  let vnp_Params: any = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = VNPayConfig.vnp_TmnCode;
  vnp_Params["vnp_Locale"] = locale;
  vnp_Params["vnp_CurrCode"] = currCode;
  vnp_Params["vnp_TxnRef"] = vnpOrderId;
  // OrderInfo: dùng format đơn giản, không có ký tự đặc biệt
  vnp_Params[
    "vnp_OrderInfo"
  ] = `Dat coc 10 cho appointment ${appointmentIdShort}`;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = depositAmount * 100;
  // Dùng Return URL giống wallet service (đã hoạt động với localhost)
  vnp_Params["vnp_ReturnUrl"] = VNPayConfig.vnp_WalletReturnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  // Debug logging để kiểm tra hash
  console.log("=== Deposit 10% Payment Debug ===");
  console.log("vnp_TmnCode:", VNPayConfig.vnp_TmnCode);
  console.log("vnp_ReturnUrl:", vnp_Params["vnp_ReturnUrl"]);
  console.log("vnp_Amount:", vnp_Params["vnp_Amount"]);
  console.log("vnp_TxnRef:", vnp_Params["vnp_TxnRef"]);
  console.log("vnp_OrderInfo:", vnp_Params["vnp_OrderInfo"]);
  console.log("Sign Data:", signData);
  console.log("Signed Hash:", signed);

  let vnpUrl =
    VNPayConfig.vnp_Url +
    "?" +
    querystring.stringify(vnp_Params, { encode: false });

  // Lưu PaymentTransaction
  await PaymentTransaction.create({
    orderId: vnpOrderId,
    userId: appointment.buyerId.toString(),
    amount: depositAmount,
    status: "PENDING",
    responseCode: "00",
    description: `Đặt cọc 10% cho appointment ${appointmentId}`,
  });

  // Lưu Payment với type DEPOSIT_10
  await Payment.create({
    userId: appointment.buyerId,
    amount: depositAmount,
    description: `Đặt cọc 10% cho appointment ${appointmentId}`,
    status: "PENDING",
    method: "VNPAY",
    transactionId: vnpOrderId,
    metadata: {
      type: "DEPOSIT_10",
      appointmentId: appointmentId,
    },
  });

  return { vnpUrl, orderId: vnpOrderId, amount: depositAmount };
};

/**
 * Tạo VNPay URL cho thanh toán toàn bộ 100% (dùng appointmentId)
 */
export const createFullPaymentUrl = async (
  appointmentId: string,
  req: Request
) => {
  // Tìm Appointment
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    throw new Error("Appointment not found");
  }

  if (appointment.status !== "CONFIRMED") {
    throw new Error("Appointment must be CONFIRMED to create full payment");
  }

  // Lấy listingId từ appointment hoặc depositRequest
  let listingId: string | null = null;

  // Ưu tiên lấy từ appointment.listingId
  if (appointment.listingId) {
    listingId = appointment.listingId.toString().replace(/,/g, ""); // Remove trailing comma if any
  }
  // Nếu không có, thử lấy từ depositRequest
  else if (appointment.depositRequestId) {
    const depositRequest = await DepositRequest.findById(
      appointment.depositRequestId.toString().replace(/,/g, "")
    );
    if (depositRequest && depositRequest.listingId) {
      listingId = depositRequest.listingId.toString().replace(/,/g, "");
    }
  }

  if (!listingId) {
    throw new Error("Listing ID not found in appointment or depositRequest");
  }

  // Lấy Listing để lấy giá
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new Error("Listing not found");
  }

  const fullAmount = listing.priceListed; // 100%

  process.env.TZ = "Asia/Ho_Chi_Minh";
  let date = new Date();
  let createDate = moment(date).format("YYYYMMDDHHmmss");

  let ipAddr: any =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "127.0.0.1";

  if (Array.isArray(ipAddr)) {
    ipAddr = ipAddr[0];
  }

  ipAddr = String(ipAddr).replace("::ffff:", "");
  if (ipAddr === "::1") {
    ipAddr = "127.0.0.1";
  }

  // Tạo orderId cho VNPay: format giống wallet service (đã hoạt động)
  // Format: FULL_appointmentIdShort_timestamp (giống userId_timestamp trong wallet)
  const appointmentIdShort = appointmentId.toString().slice(-12); // Lấy 12 ký tự cuối
  const timestamp = moment(date).format("DDHHmmss"); // Format giống wallet
  let vnpOrderId = `FULL_${appointmentIdShort}_${timestamp}`;
  let locale = "vn";
  let currCode = "VND";

  let vnp_Params: any = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = VNPayConfig.vnp_TmnCode;
  vnp_Params["vnp_Locale"] = locale;
  vnp_Params["vnp_CurrCode"] = currCode;
  vnp_Params["vnp_TxnRef"] = vnpOrderId;
  // OrderInfo: dùng format đơn giản, không có ký tự đặc biệt
  vnp_Params[
    "vnp_OrderInfo"
  ] = `Thanh toan toan bo cho appointment ${appointmentIdShort}`;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = fullAmount * 100;
  // Dùng Return URL giống wallet service (đã hoạt động với localhost)
  // walletVNPayReturn sẽ route đến appointmentFullPaymentReturn nếu vnpOrderId bắt đầu bằng "FULL_"
  vnp_Params["vnp_ReturnUrl"] = VNPayConfig.vnp_WalletReturnUrl;
  // Không thêm IPN URL vì VNPay sandbox không chấp nhận localhost cho IPN
  // Return URL sẽ xử lý logic cập nhật appointment
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  // Debug logging để kiểm tra hash
  console.log("=== Full Payment Debug ===");
  console.log("vnp_TmnCode:", VNPayConfig.vnp_TmnCode);
  console.log("vnp_ReturnUrl:", vnp_Params["vnp_ReturnUrl"]);
  console.log("vnp_Amount:", vnp_Params["vnp_Amount"]);
  console.log("vnp_TxnRef:", vnp_Params["vnp_TxnRef"]);
  console.log("vnp_OrderInfo:", vnp_Params["vnp_OrderInfo"]);
  console.log("Sign Data:", signData);
  console.log("Signed Hash:", signed);

  let vnpUrl =
    VNPayConfig.vnp_Url +
    "?" +
    querystring.stringify(vnp_Params, { encode: false });

  // Lưu PaymentTransaction
  await PaymentTransaction.create({
    orderId: vnpOrderId,
    userId: appointment.buyerId.toString(),
    amount: fullAmount,
    status: "PENDING",
    responseCode: "00",
    description: `Thanh toán toàn bộ 100% cho appointment ${appointmentId}`,
  });

  // Lưu Payment với type FULL_PAYMENT
  await Payment.create({
    userId: appointment.buyerId,
    amount: fullAmount,
    description: `Thanh toán toàn bộ 100% cho appointment ${appointmentId}`,
    status: "PENDING",
    method: "VNPAY",
    transactionId: vnpOrderId,
    metadata: {
      type: "FULL_PAYMENT",
      appointmentId: appointmentId,
    },
  });

  return { vnpUrl, orderId: vnpOrderId, amount: fullAmount };
};

/**
 * Tạo VNPay URL cho thanh toán còn lại 90% (dùng appointmentId)
 * User tự tạo sau khi đã đặt cọc 10% thành công
 */
export const createRemaining90PaymentUrl = async (
  appointmentId: string,
  req: Request
) => {
  // Tìm Appointment
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    throw new Error("Appointment not found");
  }

  if (appointment.status !== "AWAITING_REMAINING_PAYMENT") {
    throw new Error(
      "Appointment must be AWAITING_REMAINING_PAYMENT to create remaining payment"
    );
  }

  // Kiểm tra đã đặt cọc 10% chưa
  if (!appointment.timeline?.depositPaidAt) {
    throw new Error("Phải đặt cọc 10% trước khi thanh toán 90% còn lại");
  }

  // Kiểm tra chưa thanh toán 90% hoặc 100%
  if (
    appointment.timeline?.remainingPaidAt ||
    appointment.timeline?.fullPaymentPaidAt
  ) {
    throw new Error("Đã thanh toán đủ số tiền còn lại");
  }

  // Lấy listingId từ appointment hoặc depositRequest
  let listingId: string | null = null;

  // Ưu tiên lấy từ appointment.listingId
  if (appointment.listingId) {
    listingId = appointment.listingId.toString().replace(/,/g, ""); // Remove trailing comma if any
  }
  // Nếu không có, thử lấy từ depositRequest
  else if (appointment.depositRequestId) {
    const depositRequest = await DepositRequest.findById(
      appointment.depositRequestId.toString().replace(/,/g, "")
    );
    if (depositRequest && depositRequest.listingId) {
      listingId = depositRequest.listingId.toString().replace(/,/g, "");
    }
  }

  if (!listingId) {
    throw new Error("Listing ID not found in appointment or depositRequest");
  }

  // Lấy Listing để lấy giá
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new Error("Listing not found");
  }

  const totalPrice = listing.priceListed;
  const depositAmount = Math.round(totalPrice * 0.1); // 10% đã đặt cọc
  const remainingAmount = totalPrice - depositAmount; // 90% còn lại

  process.env.TZ = "Asia/Ho_Chi_Minh";
  let date = new Date();
  let createDate = moment(date).format("YYYYMMDDHHmmss");

  let ipAddr: any =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "127.0.0.1";

  if (Array.isArray(ipAddr)) {
    ipAddr = ipAddr[0];
  }

  ipAddr = String(ipAddr).replace("::ffff:", "");
  if (ipAddr === "::1") {
    ipAddr = "127.0.0.1";
  }

  // Tạo orderId cho VNPay: format giống wallet service (đã hoạt động)
  // Format: REM_appointmentIdShort_timestamp
  const appointmentIdShort = appointmentId.toString().slice(-12); // Lấy 12 ký tự cuối
  const timestamp = moment(date).format("DDHHmmss"); // Format giống wallet
  let vnpOrderId = `REM_${appointmentIdShort}_${timestamp}`;
  let locale = "vn";
  let currCode = "VND";

  let vnp_Params: any = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = VNPayConfig.vnp_TmnCode;
  vnp_Params["vnp_Locale"] = locale;
  vnp_Params["vnp_CurrCode"] = currCode;
  vnp_Params["vnp_TxnRef"] = vnpOrderId;
  // OrderInfo: dùng format đơn giản, không có ký tự đặc biệt
  vnp_Params[
    "vnp_OrderInfo"
  ] = `Thanh toan con lai cho appointment ${appointmentIdShort}`;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = remainingAmount * 100;
  // Dùng Return URL giống wallet service (đã hoạt động với localhost)
  vnp_Params["vnp_ReturnUrl"] = VNPayConfig.vnp_WalletReturnUrl;
  // Không thêm IPN URL (giống wallet service - đã hoạt động)
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  let vnpUrl =
    VNPayConfig.vnp_Url +
    "?" +
    querystring.stringify(vnp_Params, { encode: false });

  // Lưu PaymentTransaction
  await PaymentTransaction.create({
    orderId: vnpOrderId,
    userId: appointment.buyerId.toString(),
    amount: remainingAmount,
    status: "PENDING",
    responseCode: "00",
    description: `Thanh toán còn lại 90% cho appointment ${appointmentId}`,
  });

  // Lưu Payment với type REMAINING_90
  await Payment.create({
    userId: appointment.buyerId,
    amount: remainingAmount,
    description: `Thanh toán còn lại 90% cho appointment ${appointmentId}`,
    status: "PENDING",
    method: "VNPAY",
    transactionId: vnpOrderId,
    metadata: {
      type: "REMAINING_90",
      appointmentId: appointmentId,
    },
  });

  return { vnpUrl, orderId: vnpOrderId, amount: remainingAmount };
};

/**
 * Xử lý Return URL cho đặt cọc 10% (khi user quay lại từ VNPay)
 */
export const handleDeposit10Return = async (vnp_Params: any) => {
  // Gọi callback handler để xử lý logic
  const result = await handleDeposit10Callback(vnp_Params);

  // Return URL chỉ cần trả về kết quả, không cần xử lý logic phức tạp
  return result;
};

/**
 * Xử lý callback thanh toán đặt cọc 10% (dùng appointmentId)
 */
export const handleDeposit10Callback = async (vnp_Params: any) => {
  let secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash !== signed) {
    return {
      success: false,
      responseCode: "97",
      message: "Chữ ký không hợp lệ",
    };
  }

  let vnpOrderId = vnp_Params["vnp_TxnRef"];
  let responseCode = vnp_Params["vnp_ResponseCode"];
  let amount = parseInt(vnp_Params["vnp_Amount"]) / 100;
  let vnp_TransactionNo = vnp_Params["vnp_TransactionNo"];

  // Lấy appointmentId từ vnpOrderId: appointmentIdShort_timestamp
  // Format: {appointmentIdShort}_{timestamp} (giống wallet service)
  if (!vnpOrderId.includes("_")) {
    return {
      success: false,
      responseCode: "99",
      message: "Không thể xác định appointmentId từ vnpOrderId",
    };
  }
  // Lấy appointmentIdShort từ vnpOrderId (phần trước dấu gạch dưới đầu tiên)
  const appointmentIdShort = vnpOrderId.split("_")[0];
  // Tìm appointment có _id kết thúc bằng appointmentIdShort
  const appointments = await Appointment.find({});
  const appointment = appointments.find((apt: any) =>
    apt._id.toString().endsWith(appointmentIdShort)
  );
  if (!appointment) {
    return {
      success: false,
      responseCode: "99",
      message: "Không tìm thấy appointment từ vnpOrderId",
    };
  }
  const appointmentId = (appointment as any)._id.toString();

  // Tìm PaymentTransaction
  let paymentTransaction = await PaymentTransaction.findOne({
    orderId: vnpOrderId,
  });

  if (!paymentTransaction) {
    return {
      success: false,
      responseCode: "99",
      message: "Không tìm thấy giao dịch",
    };
  }

  // Nếu đã xử lý rồi
  if (paymentTransaction.status === "SUCCESS") {
    return {
      success: true,
      responseCode: paymentTransaction.responseCode,
      appointmentId,
      amount: paymentTransaction.amount,
      message: "Giao dịch đã được xử lý trước đó",
    };
  }

  // Cập nhật PaymentTransaction
  paymentTransaction.status = responseCode === "00" ? "SUCCESS" : "FAILED";
  paymentTransaction.responseCode = responseCode;
  paymentTransaction.vnp_TransactionNo = vnp_TransactionNo;
  paymentTransaction.processedAt = new Date();
  await paymentTransaction.save();

  if (responseCode === "00") {
    try {
      // Appointment đã được tìm ở trên
      if (!appointment) {
        throw new Error("Appointment not found");
      }

      // Cập nhật Payment
      await Payment.updateOne(
        { transactionId: vnpOrderId },
        {
          status: "COMPLETED",
          transactionId: vnp_TransactionNo,
        }
      );

      // Chuyển tiền vào ví hệ thống
      await systemWalletService.deposit(
        amount,
        `Đặt cọc 10% từ user ${appointment.buyerId} cho appointment ${appointmentId}`,
        "COMPLETED",
        undefined,
        appointmentId
      );

      // Cập nhật Appointment: timeline.depositPaidAt + status
      if (!appointment.timeline) {
        appointment.timeline = {};
      }
      appointment.timeline.depositPaidAt = new Date();

      // Nếu appointment chưa completed/cancelled thì chuyển sang trạng thái chờ thanh toán còn lại
      const statusCanUpdate = !["COMPLETED", "CANCELLED", "REJECTED"].includes(
        appointment.status as string
      );
      if (statusCanUpdate) {
        appointment.status = "AWAITING_REMAINING_PAYMENT" as any;
      }
      await appointment.save();

      // Cập nhật listing status thành "InTransaction" khi đặt cọc 10%
      let listingId: string | null = null;
      if (appointment.listingId) {
        listingId = appointment.listingId.toString().replace(/,/g, "");
      } else if (appointment.depositRequestId) {
        const depositRequest = await DepositRequest.findById(
          appointment.depositRequestId.toString().replace(/,/g, "")
        );
        if (depositRequest && depositRequest.listingId) {
          listingId = depositRequest.listingId.toString().replace(/,/g, "");
        }
      }

      if (listingId) {
        try {
          const listing = await Listing.findById(listingId);
          if (listing && listing.status === "Published") {
            listing.status = "InTransaction";
            await listing.save();
            console.log(
              `✅ [Deposit 10%] Updated listing ${listingId} status to "InTransaction"`
            );
          } else if (listing && listing.status !== "InTransaction") {
            console.log(
              `⚠️ [Deposit 10%] Listing ${listingId} status is "${listing.status}", not updating to InTransaction`
            );
          }
        } catch (listingError: any) {
          console.error(
            `❌ [Deposit 10%] Error updating listing status:`,
            listingError.message
          );
          // Không throw error vì thanh toán đã thành công, chỉ log
        }
      } else {
        console.log(
          `⚠️ [Deposit 10%] No listingId found in appointment, skipping listing update`
        );
      }

      // Gửi email và notification
      const buyer = await User.findById(appointment.buyerId);
      if (buyer && buyer.email) {
        try {
          const formattedAmount = amount.toLocaleString("vi-VN");
          const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #155724; margin-top: 0;">✅ Thanh toán đặt cọc thành công</h2>
                <p style="font-size: 16px; margin-bottom: 0;">Chào ${
                  buyer.fullName || buyer.email
                },</p>
              </div>
              
              <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="font-size: 16px; line-height: 1.6;">
                  Bạn đã thanh toán đặt cọc <strong>${formattedAmount} VND</strong> (10% giá trị) thành công.
                </p>
                
                <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <h3 style="color: #495057; margin-top: 0;">📋 Thông tin:</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li><strong>Mã appointment:</strong> ${appointmentId}</li>
                    <li><strong>Số tiền đặt cọc:</strong> ${formattedAmount} VND</li>
                    <li><strong>Trạng thái:</strong> Đã thanh toán đặt cọc</li>
                  </ul>
                </div>
              </div>
            </div>
          `;

          await emailService.sendEmail(
            buyer.email,
            "Thanh toán đặt cọc thành công",
            emailContent
          );
          console.log(
            `✅ Email sent to ${buyer.email} for deposit payment success`
          );
        } catch (emailError: any) {
          console.error(
            `❌ Failed to send email to ${buyer.email}:`,
            emailError.message
          );
          // Không throw error để không ảnh hưởng đến flow chính
        }
      } else {
        console.log(
          `⚠️ Buyer not found or no email for appointment ${appointmentId}`
        );
      }

      // Gửi notification vào database
      try {
        const notification = await NotificationMessage.create({
          userId: new Types.ObjectId(appointment.buyerId),
          type: "appointment",
          title: "✅ Đặt cọc thành công",
          message: `Bạn đã thanh toán đặt cọc ${amount.toLocaleString(
            "vi-VN"
          )} VND thành công. Vào xem lịch hẹn để thanh toán còn lại.`,
          relatedId: new Types.ObjectId(appointmentId),
          isRead: false,
          isDeleted: false,
          actionUrl: `/appointments/${appointmentId}`,
          actionText: "Xem lịch hẹn",
          metadata: {
            appointmentId: appointmentId,
            amount: amount,
            type: "deposit_success",
            canPayRemaining: true, // FE sẽ dùng flag này để hiển thị nút "Thanh toán còn lại"
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
          console.log(
            `✅ WebSocket notification sent to user ${appointment.buyerId}`
          );
        } catch (wsError) {
          console.log(
            "⚠️ WebSocket not available, notification saved to DB only"
          );
        }

        console.log(
          `✅ Notification created for user ${appointment.buyerId}: ${notification._id}`
        );
      } catch (notifError: any) {
        console.error("❌ Failed to create notification:", notifError.message);
        // Không throw error để không ảnh hưởng đến flow chính
      }

      return {
        success: true,
        responseCode,
        appointmentId,
        amount,
        message: "Thanh toán đặt cọc thành công",
      };
    } catch (error: any) {
      console.error("❌ [Deposit 10%] Error processing payment:", error);

      paymentTransaction.status = "FAILED";
      await paymentTransaction.save();

      return {
        success: false,
        responseCode: "99",
        message: "Lỗi khi xử lý thanh toán: " + error.message,
      };
    }
  } else {
    return {
      success: false,
      responseCode,
      message: getVNPayMessage(responseCode),
    };
  }
};

/**
 * Xử lý Return URL cho thanh toán toàn bộ 100% (khi user quay lại từ VNPay)
 */
export const handleFullPaymentReturn = async (vnp_Params: any) => {
  // Gọi callback handler để xử lý logic
  const result = await handleFullPaymentCallback(vnp_Params);

  // Return URL chỉ cần trả về kết quả, không cần xử lý logic phức tạp
  return result;
};

/**
 * Xử lý callback thanh toán toàn bộ 100% (dùng appointmentId)
 */
export const handleFullPaymentCallback = async (vnp_Params: any) => {
  let secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash !== signed) {
    return {
      success: false,
      responseCode: "97",
      message: "Chữ ký không hợp lệ",
    };
  }

  let vnpOrderId = vnp_Params["vnp_TxnRef"];
  let responseCode = vnp_Params["vnp_ResponseCode"];
  let amount = parseInt(vnp_Params["vnp_Amount"]) / 100;
  let vnp_TransactionNo = vnp_Params["vnp_TransactionNo"];

  // Tìm Payment để lấy appointmentId từ metadata (chính xác hơn)
  const payment = await Payment.findOne({
    transactionId: vnpOrderId,
    "metadata.type": "FULL_PAYMENT",
  });

  if (!payment || !payment.metadata?.appointmentId) {
    console.error(
      `[Full Payment] ❌ Payment not found or no appointmentId for orderId: ${vnpOrderId}`
    );
    return {
      success: false,
      responseCode: "99",
      message: "Không tìm thấy payment hoặc appointmentId từ vnpOrderId",
    };
  }

  const appointmentId = payment.metadata.appointmentId.toString();
  console.log(
    `[Full Payment] 🔍 Found appointmentId from Payment: ${appointmentId}`
  );

  // Tìm Appointment
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    console.error(`[Full Payment] ❌ Appointment not found: ${appointmentId}`);
    return {
      success: false,
      responseCode: "99",
      message: "Không tìm thấy appointment từ appointmentId",
    };
  }
  console.log(
    `[Full Payment] ✅ Found appointment: ${appointmentId}, current status: ${appointment.status}`
  );

  // Tìm PaymentTransaction
  let paymentTransaction = await PaymentTransaction.findOne({
    orderId: vnpOrderId,
  });

  if (!paymentTransaction) {
    return {
      success: false,
      responseCode: "99",
      message: "Không tìm thấy giao dịch",
    };
  }

  // Nếu đã xử lý rồi, kiểm tra xem appointment đã được cập nhật chưa
  if (paymentTransaction.status === "SUCCESS") {
    // Kiểm tra appointment có status COMPLETED chưa
    const existingAppointment = await Appointment.findById(appointmentId);
    if (existingAppointment && existingAppointment.status === "COMPLETED") {
      // Đã xử lý đầy đủ, return
      console.log(
        `[Full Payment] ✅ Already processed: appointment ${appointmentId} is COMPLETED`
      );
      return {
        success: true,
        responseCode: paymentTransaction.responseCode,
        appointmentId,
        amount: paymentTransaction.amount,
        message: "Giao dịch đã được xử lý trước đó",
      };
    } else {
      // PaymentTransaction đã SUCCESS nhưng appointment chưa được cập nhật → tiếp tục xử lý
      console.log(
        `[Full Payment] ⚠️ PaymentTransaction SUCCESS but appointment ${appointmentId} not COMPLETED (status: ${existingAppointment?.status}), continuing...`
      );
    }
  }

  // Cập nhật PaymentTransaction
  paymentTransaction.status = responseCode === "00" ? "SUCCESS" : "FAILED";
  paymentTransaction.responseCode = responseCode;
  paymentTransaction.vnp_TransactionNo = vnp_TransactionNo;
  paymentTransaction.processedAt = new Date();
  await paymentTransaction.save();

  if (responseCode === "00") {
    try {
      // Appointment và Payment đã được tìm ở trên
      if (!appointment) {
        throw new Error("Appointment not found");
      }
      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment) {
        // Cập nhật Payment
        payment.status = "COMPLETED";
        payment.transactionId = vnp_TransactionNo;
        await payment.save();
      }

      // Chuyển tiền vào ví hệ thống
      await systemWalletService.deposit(
        amount,
        `Thanh toán toàn bộ 100% từ user ${appointment.buyerId} cho appointment ${appointmentId}`,
        "COMPLETED",
        undefined,
        appointmentId
      );

      // Cập nhật Appointment: timeline.fullPaymentPaidAt, timeline.completedAt, status = COMPLETED
      console.log(
        `[Full Payment] 📝 Updating appointment ${appointmentId} status to COMPLETED...`
      );
      if (!appointment.timeline) {
        appointment.timeline = {};
      }
      appointment.timeline.fullPaymentPaidAt = new Date();
      appointment.timeline.completedAt = new Date();
      appointment.status = "COMPLETED";
      await appointment.save();
      console.log(
        `[Full Payment] ✅ Appointment ${appointmentId} saved with status COMPLETED`
      );

      // Cập nhật listing status thành "Sold" khi thanh toán toàn bộ 100%
      let listingId: string | null = null;
      if (appointment.listingId) {
        listingId = appointment.listingId.toString().replace(/,/g, "");
      } else if (appointment.depositRequestId) {
        const depositRequest = await DepositRequest.findById(
          appointment.depositRequestId.toString().replace(/,/g, "")
        );
        if (depositRequest && depositRequest.listingId) {
          listingId = depositRequest.listingId.toString().replace(/,/g, "");
        }
      }

      if (listingId) {
        try {
          const listing = await Listing.findById(listingId);
          if (listing && listing.status !== "Sold") {
            listing.status = "Sold";
            await listing.save();
            console.log(
              `✅ [Full Payment] Updated listing ${listingId} status to "Sold"`
            );
          } else if (listing && listing.status === "Sold") {
            console.log(`⚠️ [Full Payment] Listing ${listingId} already sold`);
          }
        } catch (listingError: any) {
          console.error(
            `❌ [Full Payment] Error updating listing status:`,
            listingError.message
          );
          // Không throw error vì thanh toán đã thành công, chỉ log
        }
      } else {
        console.log(
          `⚠️ [Full Payment] No listingId found in appointment, skipping listing update`
        );
      }

      // Verify appointment was saved correctly
      const savedAppointment = await Appointment.findById(appointmentId);
      if (savedAppointment) {
        console.log(
          `[Full Payment] ✅ Verified: Appointment ${appointmentId} status in DB: ${savedAppointment.status}`
        );
      } else {
        console.error(
          `[Full Payment] ❌ ERROR: Appointment ${appointmentId} not found after save!`
        );
      }

      // Gửi email và notification
      const buyer = await User.findById(appointment.buyerId);
      if (buyer && buyer.email) {
        try {
          const formattedAmount = amount.toLocaleString("vi-VN");
          const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #155724; margin-top: 0;">🎉 Đơn hàng đã hoàn thành</h2>
                <p style="font-size: 16px; margin-bottom: 0;">Chào ${
                  buyer.fullName || buyer.email
                },</p>
              </div>
              
              <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="font-size: 16px; line-height: 1.6;">
                  Bạn đã thanh toán đủ <strong>100%</strong> giá trị. Giao dịch đã được hoàn thành.
                </p>
                
                <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <h3 style="color: #495057; margin-top: 0;">📋 Thông tin:</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li><strong>Mã appointment:</strong> ${appointmentId}</li>
                    <li><strong>Số tiền thanh toán:</strong> ${formattedAmount} VND</li>
                    <li><strong>Trạng thái:</strong> Đã hoàn thành</li>
                  </ul>
                </div>
                
                <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <h3 style="color: #0c5460; margin-top: 0;">✅ Cảm ơn bạn đã sử dụng dịch vụ!</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                    Giao dịch của bạn đã được xử lý thành công. Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.
                  </p>
                </div>
              </div>
            </div>
          `;

          await emailService.sendEmail(
            buyer.email,
            "Bạn đã thanh toán đủ 100%. Đơn hàng đã hoàn thành.",
            emailContent
          );
          console.log(
            `✅ Email sent to ${buyer.email} for full payment success`
          );
        } catch (emailError: any) {
          console.error(
            `❌ Failed to send email to ${buyer.email}:`,
            emailError.message
          );
          // Không throw error để không ảnh hưởng đến flow chính
        }
      } else {
        console.log(
          `⚠️ Buyer not found or no email for appointment ${appointmentId}`
        );
      }

      // Gửi notification vào database
      try {
        const notification = await NotificationMessage.create({
          userId: new Types.ObjectId(appointment.buyerId),
          type: "appointment",
          title: "🎉 Giao dịch hoàn thành",
          message: `Bạn đã thanh toán đủ 100%, appointment ${appointmentId} đã hoàn thành.`,
          relatedId: new Types.ObjectId(appointmentId),
          isRead: false,
          isDeleted: false,
          actionUrl: `/appointments/${appointmentId}`,
          actionText: "Xem chi tiết",
          metadata: {
            appointmentId: appointmentId,
            amount: amount,
            type: "full_payment_success",
            isCompleted: true,
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
          console.log(
            `✅ WebSocket notification sent to user ${appointment.buyerId}`
          );
        } catch (wsError) {
          console.log(
            "⚠️ WebSocket not available, notification saved to DB only"
          );
        }

        console.log(
          `✅ Notification created for user ${appointment.buyerId}: ${notification._id}`
        );
      } catch (notifError: any) {
        console.error("❌ Failed to create notification:", notifError.message);
      }

      return {
        success: true,
        responseCode,
        appointmentId,
        amount,
        message: "Thanh toán toàn bộ thành công, giao dịch đã hoàn thành",
      };
    } catch (error: any) {
      console.error("❌ [Full Payment] Error processing payment:", error);

      paymentTransaction.status = "FAILED";
      await paymentTransaction.save();

      return {
        success: false,
        responseCode: "99",
        message: "Lỗi khi xử lý thanh toán: " + error.message,
      };
    }
  } else {
    return {
      success: false,
      responseCode,
      message: getVNPayMessage(responseCode),
    };
  }
};

/**
 * Xử lý Return URL cho thanh toán còn lại 90% (khi user quay lại từ VNPay)
 */
export const handleRemaining90Return = async (vnp_Params: any) => {
  // Gọi callback handler để xử lý logic
  const result = await handleRemaining90Callback(vnp_Params);

  // Return URL chỉ cần trả về kết quả, không cần xử lý logic phức tạp
  return result;
};

/**
 * Xử lý callback thanh toán còn lại 90% (dùng appointmentId)
 */
export const handleRemaining90Callback = async (vnp_Params: any) => {
  let secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash !== signed) {
    return {
      success: false,
      responseCode: "97",
      message: "Chữ ký không hợp lệ",
    };
  }

  let vnpOrderId = vnp_Params["vnp_TxnRef"];
  let responseCode = vnp_Params["vnp_ResponseCode"];
  let amount = parseInt(vnp_Params["vnp_Amount"]) / 100;
  let vnp_TransactionNo = vnp_Params["vnp_TransactionNo"];

  // Lấy appointmentId từ vnpOrderId: REM_appointmentIdShort_timestamp
  // Format: REM_{appointmentIdShort}_{timestamp}
  if (!vnpOrderId.startsWith("REM_") || !vnpOrderId.includes("_")) {
    return {
      success: false,
      responseCode: "99",
      message: "Không thể xác định appointmentId từ vnpOrderId",
    };
  }
  // Lấy appointmentIdShort từ vnpOrderId (phần giữa "REM_" và dấu gạch dưới cuối)
  const parts = vnpOrderId.split("_");
  const appointmentIdShort = parts[1]; // Phần sau "REM"
  // Tìm appointment có _id kết thúc bằng appointmentIdShort
  const appointments = await Appointment.find({});
  const appointment = appointments.find((apt: any) =>
    apt._id.toString().endsWith(appointmentIdShort)
  );
  if (!appointment) {
    return {
      success: false,
      responseCode: "99",
      message: "Không tìm thấy appointment từ vnpOrderId",
    };
  }
  const appointmentId = (appointment as any)._id.toString();

  // Tìm PaymentTransaction
  let paymentTransaction = await PaymentTransaction.findOne({
    orderId: vnpOrderId,
  });

  if (!paymentTransaction) {
    return {
      success: false,
      responseCode: "99",
      message: "Không tìm thấy giao dịch",
    };
  }

  // Nếu đã xử lý rồi
  if (paymentTransaction.status === "SUCCESS") {
    return {
      success: true,
      responseCode: paymentTransaction.responseCode,
      appointmentId,
      amount: paymentTransaction.amount,
      message: "Giao dịch đã được xử lý trước đó",
    };
  }

  // Cập nhật PaymentTransaction
  paymentTransaction.status = responseCode === "00" ? "SUCCESS" : "FAILED";
  paymentTransaction.responseCode = responseCode;
  paymentTransaction.vnp_TransactionNo = vnp_TransactionNo;
  paymentTransaction.processedAt = new Date();
  await paymentTransaction.save();

  if (responseCode === "00") {
    try {
      // Appointment đã được tìm ở trên
      if (!appointment) {
        throw new Error("Appointment not found");
      }

      // Tìm Payment với type REMAINING_90
      const payment = await Payment.findOne({
        transactionId: vnpOrderId,
        "metadata.type": "REMAINING_90",
      });

      if (payment) {
        // Cập nhật Payment
        payment.status = "COMPLETED";
        payment.transactionId = vnp_TransactionNo;
        await payment.save();
      }

      // Chuyển tiền vào ví hệ thống
      await systemWalletService.deposit(
        amount,
        `Thanh toán còn lại 90% từ user ${appointment.buyerId} cho appointment ${appointmentId}`,
        "COMPLETED",
        undefined,
        appointmentId
      );

      // Cập nhật Appointment: timeline.remainingPaidAt, timeline.completedAt, status = COMPLETED
      if (!appointment.timeline) {
        appointment.timeline = {};
      }
      appointment.timeline.remainingPaidAt = new Date();
      appointment.timeline.completedAt = new Date();
      appointment.status = "COMPLETED";
      await appointment.save();

      // Cập nhật listing status thành "Sold" khi thanh toán còn lại 90%
      let listingId: string | null = null;
      if (appointment.listingId) {
        listingId = appointment.listingId.toString().replace(/,/g, "");
      } else if (appointment.depositRequestId) {
        const depositRequest = await DepositRequest.findById(
          appointment.depositRequestId.toString().replace(/,/g, "")
        );
        if (depositRequest && depositRequest.listingId) {
          listingId = depositRequest.listingId.toString().replace(/,/g, "");
        }
      }

      if (listingId) {
        try {
          const listing = await Listing.findById(listingId);
          if (listing && listing.status !== "Sold") {
            listing.status = "Sold";
            await listing.save();
            console.log(
              `✅ [Remaining 90%] Updated listing ${listingId} status to "Sold"`
            );
          } else if (listing && listing.status === "Sold") {
            console.log(`⚠️ [Remaining 90%] Listing ${listingId} already sold`);
          }
        } catch (listingError: any) {
          console.error(
            `❌ [Remaining 90%] Error updating listing status:`,
            listingError.message
          );
          // Không throw error vì thanh toán đã thành công, chỉ log
        }
      } else {
        console.log(
          `⚠️ [Remaining 90%] No listingId found in appointment, skipping listing update`
        );
      }

      // Gửi email và notification
      const buyer = await User.findById(appointment.buyerId);
      if (buyer && buyer.email) {
        try {
          const formattedAmount = amount.toLocaleString("vi-VN");
          const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #155724; margin-top: 0;">🎉 Giao dịch đã hoàn thành</h2>
                <p style="font-size: 16px; margin-bottom: 0;">Chào ${
                  buyer.fullName || buyer.email
                },</p>
              </div>
              
              <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="font-size: 16px; line-height: 1.6;">
                  Bạn đã thanh toán đủ <strong>100%</strong> giá trị (10% đặt cọc + 90% còn lại). Giao dịch đã được hoàn thành.
                </p>
                
                <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <h3 style="color: #495057; margin-top: 0;">📋 Thông tin:</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li><strong>Mã appointment:</strong> ${appointmentId}</li>
                    <li><strong>Số tiền thanh toán còn lại:</strong> ${formattedAmount} VND</li>
                    <li><strong>Trạng thái:</strong> Đã hoàn thành</li>
                  </ul>
                </div>
                
                <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <h3 style="color: #0c5460; margin-top: 0;">✅ Cảm ơn bạn đã sử dụng dịch vụ!</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                    Giao dịch của bạn đã được xử lý thành công. Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.
                  </p>
                </div>
              </div>
            </div>
          `;

          await emailService.sendEmail(
            buyer.email,
            "Bạn đã thanh toán đủ 100%. Giao dịch đã hoàn thành.",
            emailContent
          );
          console.log(
            `✅ Email sent to ${buyer.email} for remaining payment success`
          );
        } catch (emailError: any) {
          console.error(
            `❌ Failed to send email to ${buyer.email}:`,
            emailError.message
          );
          // Không throw error để không ảnh hưởng đến flow chính
        }
      } else {
        console.log(
          `⚠️ Buyer not found or no email for appointment ${appointmentId}`
        );
      }

      // Gửi notification vào database
      try {
        const notification = await NotificationMessage.create({
          userId: new Types.ObjectId(appointment.buyerId),
          type: "appointment",
          title: "🎉 Giao dịch hoàn thành",
          message: `Bạn đã thanh toán đủ 100% (10% đặt cọc + 90% còn lại), appointment ${appointmentId} đã hoàn thành.`,
          relatedId: new Types.ObjectId(appointmentId),
          isRead: false,
          isDeleted: false,
          actionUrl: `/appointments/${appointmentId}`,
          actionText: "Xem chi tiết",
          metadata: {
            appointmentId: appointmentId,
            amount: amount,
            type: "remaining_payment_success",
            isCompleted: true,
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
          console.log(
            `✅ WebSocket notification sent to user ${appointment.buyerId}`
          );
        } catch (wsError) {
          console.log(
            "⚠️ WebSocket not available, notification saved to DB only"
          );
        }

        console.log(
          `✅ Notification created for user ${appointment.buyerId}: ${notification._id}`
        );
      } catch (notifError: any) {
        console.error("❌ Failed to create notification:", notifError.message);
      }

      return {
        success: true,
        responseCode,
        appointmentId,
        amount,
        message: "Thanh toán còn lại thành công, giao dịch đã hoàn thành",
      };
    } catch (error: any) {
      console.error("❌ [Remaining 90%] Error processing payment:", error);

      paymentTransaction.status = "FAILED";
      await paymentTransaction.save();

      return {
        success: false,
        responseCode: "99",
        message: "Lỗi khi xử lý thanh toán: " + error.message,
      };
    }
  } else {
    return {
      success: false,
      responseCode,
      message: getVNPayMessage(responseCode),
    };
  }
};

function getVNPayMessage(code: string): string {
  const messages: Record<string, string> = {
    "00": "Giao dịch thành công",
    "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ",
    "09": "Thẻ/Tài khoản chưa đăng ký InternetBanking",
    "10": "Xác thực thông tin không đúng quá 3 lần",
    "11": "Đã hết hạn chờ thanh toán",
    "12": "Thẻ/Tài khoản bị khóa",
    "13": "Nhập sai OTP",
    "24": "Khách hàng hủy giao dịch",
    "51": "Tài khoản không đủ số dư",
    "65": "Vượt quá hạn mức giao dịch trong ngày",
    "75": "Ngân hàng thanh toán đang bảo trì",
    "79": "Nhập sai mật khẩu thanh toán quá số lần quy định",
    "99": "Lỗi không xác định",
  };

  return messages[code] || "Lỗi không xác định";
}
