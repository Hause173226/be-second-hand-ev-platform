import QRCode from "qrcode";
import { VNPayConfig } from "../config/vnpay";
import crypto from "crypto";
import moment from "moment";
import querystring from "qs";
import { Request } from "express";
import PaymentTransaction from "../models/PaymentTransaction";

// Helper function để sort object (giống walletService)
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
 * Tạo URL thanh toán VNPay
 */
async function createVNPayUrl(
  userId: string,
  amount: number,
  description: string,
  req: Request,
  returnUrl?: string,
  customOrderId?: string
): Promise<string> {
  if (!amount || amount <= 0) {
    throw new Error("Số tiền không hợp lệ");
  }

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

  // Tạo orderId unique: userId_timestamp_random (để có thể extract userId khi callback)
  let orderId: string;
  if (customOrderId) {
    orderId = customOrderId;
  } else {
    // Format: userId_YYYYMMDDHHmmss_random (tối đa ~30 ký tự, vẫn trong giới hạn VNPay)
    const timestamp = moment(date).format("YYYYMMDDHHmmss");
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 số ngẫu nhiên
    orderId = `${userId}_${timestamp}${randomNum}`;
  }
  let bankCode = "";
  let locale = "vn";
  let currCode = "VND";

  let vnp_Params: any = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = VNPayConfig.vnp_TmnCode;
  vnp_Params["vnp_Locale"] = locale;
  vnp_Params["vnp_CurrCode"] = currCode;
  vnp_Params["vnp_TxnRef"] = orderId;
  vnp_Params["vnp_OrderInfo"] = description;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = amount * 100;
  vnp_Params["vnp_ReturnUrl"] = returnUrl || VNPayConfig.vnp_WalletReturnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;

  if (bankCode !== null && bankCode !== "") {
    vnp_Params["vnp_BankCode"] = bankCode;
  }

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  let vnpUrl =
    VNPayConfig.vnp_Url +
    "?" +
    querystring.stringify(vnp_Params, { encode: false });

  return vnpUrl;
}

/**
 * Generate QR Code thanh toán
 * @param amount - Số tiền cần thanh toán
 * @param description - Mô tả thanh toán
 * @param userId - ID người dùng
 * @param req - Request object để lấy IP
 * @param returnUrl - URL return sau khi thanh toán (optional)
 * @returns Object chứa QR code data URL và payment URL
 */
export async function generateQrCode(
  amount: number,
  description: string,
  userId: string,
  req: Request,
  returnUrl?: string,
  customOrderId?: string,
  listingId?: string,
  depositRequestId?: string
): Promise<{ qrCodeDataUrl: string; paymentUrl: string; orderId: string }> {
  try {
    // Tạo orderId trước (cần để lưu vào DB)
    // Format: userId_timestamp_random để có thể extract userId khi callback
    let orderId: string;
    if (customOrderId) {
      orderId = customOrderId;
    } else {
      const date = new Date();
      // Format: userId_YYYYMMDDHHmmss_random (tối đa ~30 ký tự, vẫn trong giới hạn VNPay)
      const timestamp = moment(date).format("YYYYMMDDHHmmss");
      const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 số ngẫu nhiên
      orderId = `${userId}_${timestamp}${randomNum}`;
    }

    // Lưu PaymentTransaction vào DB với status PENDING trước khi tạo payment URL
    try {
      console.log(
        `[QR Code] Creating PaymentTransaction with orderId: ${orderId}, userId: ${userId}, amount: ${amount}, listingId: ${
          listingId || "N/A"
        }`
      );
      const savedTransaction = await PaymentTransaction.create({
        orderId,
        userId,
        amount,
        status: "PENDING",
        responseCode: "00", // Tạm thời, sẽ được cập nhật khi callback
        description: description,
        listingId: listingId,
        depositRequestId: depositRequestId,
      });
      console.log(
        `[QR Code] ✅ PaymentTransaction created successfully:`,
        savedTransaction.orderId
      );
    } catch (dbError: any) {
      console.error(`[QR Code] ❌ Error creating PaymentTransaction:`, dbError);
      // Nếu orderId đã tồn tại, thử tạo lại với orderId mới
      if (dbError.code === 11000) {
        console.log(`[QR Code] OrderId duplicate, generating new one...`);
        const date = new Date();
        const timestamp = moment(date).format("YYYYMMDDHHmmss");
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        orderId = `${userId}_${timestamp}${randomNum}`;
        console.log(`[QR Code] New orderId: ${orderId}`);
        const savedTransaction = await PaymentTransaction.create({
          orderId,
          userId,
          amount,
          status: "PENDING",
          responseCode: "00",
          description: description,
          listingId: listingId,
          depositRequestId: depositRequestId,
        });
        console.log(
          `[QR Code] ✅ PaymentTransaction created with new orderId:`,
          savedTransaction.orderId
        );
      } else {
        throw dbError;
      }
    }

    // Tạo URL thanh toán VNPay với orderId đã lưu
    const paymentUrl = await createVNPayUrl(
      userId,
      amount,
      description,
      req,
      returnUrl,
      orderId
    );

    // Tạo QR code từ URL thanh toán
    const qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, {
      errorCorrectionLevel: "M",
      type: "image/png",
      width: 300,
      margin: 1,
    });

    return {
      qrCodeDataUrl,
      paymentUrl,
      orderId, // Trả về orderId đã tạo và lưu vào DB
    };
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Không thể tạo mã QR thanh toán");
  }
}

/**
 * Generate QR Code cho đặt cọc (chuyển vào ví hệ thống)
 */
export async function generateDepositQrCode(
  depositAmount: number,
  listingTitle: string,
  userId: string,
  req: Request,
  depositRequestId?: string,
  userName?: string
): Promise<{ qrCodeDataUrl: string; paymentUrl: string; orderId: string }> {
  const userInfo = userName ? ` - ${userName}` : "";
  const description = `Đặt cọc mua xe ${listingTitle}${userInfo}`;

  // Nếu có depositRequestId, thêm vào orderId để liên kết sau
  let customOrderId: string | undefined;
  if (depositRequestId) {
    // Tạo orderId ngắn: timestamp + depositRequestId (6 ký tự cuối) + random
    const moment = (await import("moment")).default;
    const timestamp = moment().format("YYYYMMDDHHmmss");
    const depositIdShort = depositRequestId.slice(-6); // 6 ký tự cuối của depositRequestId
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    // Format: timestamp(14) + depositIdShort(6) + random(4) = 24 ký tự
    // Nhưng để ngắn hơn, chỉ dùng: timestamp(14) + random(4) = 18 ký tự, lưu depositRequestId vào DB
    customOrderId = `${timestamp}${randomNum}`;
    // Note: depositRequestId sẽ được lưu trong PaymentTransaction.description hoặc tìm từ DB
  }

  // Đặt cọc: chuyển vào ví hệ thống
  return generateQrCode(
    depositAmount,
    description,
    userId,
    req,
    VNPayConfig.vnp_DepositReturnUrl,
    customOrderId,
    undefined, // listingId - không có cho đặt cọc
    depositRequestId // depositRequestId
  );
}

/**
 * Generate QR Code cho số tiền còn lại (chuyển vào ví hệ thống)
 */
export async function generateRemainingAmountQrCode(
  remainingAmount: number,
  listingTitle: string,
  userId: string,
  req: Request,
  userName?: string
): Promise<{ qrCodeDataUrl: string; paymentUrl: string; orderId: string }> {
  const userInfo = userName ? ` - ${userName}` : "";
  const description = `Thanh toán số tiền còn lại mua xe ${listingTitle}${userInfo}`;
  // Số tiền còn lại: chuyển vào ví hệ thống
  return generateQrCode(
    remainingAmount,
    description,
    userId,
    req,
    VNPayConfig.vnp_RemainingReturnUrl
  );
}

/**
 * Generate QR Code cho mua full (chuyển vào ví hệ thống)
 */
export async function generateFullPaymentQrCode(
  fullAmount: number,
  listingTitle: string,
  userId: string,
  req: Request,
  userName?: string,
  listingId?: string
): Promise<{ qrCodeDataUrl: string; paymentUrl: string; orderId: string }> {
  const userInfo = userName ? ` - ${userName}` : "";
  const description = `Thanh toán toàn bộ mua xe ${listingTitle}${userInfo}`;
  // Mua full: chuyển vào ví hệ thống
  return generateQrCode(
    fullAmount,
    description,
    userId,
    req,
    VNPayConfig.vnp_FullPaymentReturnUrl,
    undefined, // customOrderId
    listingId, // listingId
    undefined // depositRequestId
  );
}

export default {
  generateQrCode,
  generateDepositQrCode,
  generateRemainingAmountQrCode,
  generateFullPaymentQrCode,
};
