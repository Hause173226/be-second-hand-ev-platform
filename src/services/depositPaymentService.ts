import crypto from "crypto";
import querystring from "qs";
import { VNPayConfig } from "../config/vnpay";
import walletService from "./walletService";
import systemWalletService from "./systemWalletService";
import PaymentTransaction from "../models/PaymentTransaction";
import Listing from "../models/Listing";
// [FULL_PAYMENT_APPOINTMENT] - Import để tạo Appointment và DepositRequest khi thanh toán toàn bộ thành công
import Appointment from "../models/Appointment";
import DepositRequest from "../models/DepositRequest";

// Helper function để sort object
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
 * Xử lý callback VNPay cho đặt cọc
 * Nạp tiền vào ví người dùng (để đóng băng sau)
 */
export const handleDepositPaymentReturn = async (vnp_Params: any) => {
  let secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash === signed) {
    let orderId = vnp_Params["vnp_TxnRef"];
    let responseCode = vnp_Params["vnp_ResponseCode"];
    let amount = parseInt(vnp_Params["vnp_Amount"]) / 100;
    let vnp_TransactionNo = vnp_Params["vnp_TransactionNo"];

    // Check xem giao dịch đã được xử lý chưa
    let existingTransaction = await PaymentTransaction.findOne({ orderId });
    let paymentTransaction: any;

    console.log(`[Full Payment] Looking for orderId: ${orderId}`);
    console.log(`[Full Payment] Found transaction:`, existingTransaction ? "YES" : "NO");

    // Lấy userId từ orderId (giống như nạp tiền vào ví)
    // Format: userId_timestamp_random
    let userId: string;
    if (orderId.includes("_")) {
      userId = orderId.split("_")[0];
      console.log(`[Full Payment] UserId extracted from orderId: ${userId}`);
    } else if (existingTransaction) {
      // Fallback: nếu orderId không có dấu gạch dưới, lấy từ PaymentTransaction
      userId = existingTransaction.userId;
      console.log(`[Full Payment] UserId from transaction: ${userId}`);
    } else {
      // Nếu không tìm thấy, log để debug
      console.error(`[Full Payment] ❌ Không thể lấy userId từ orderId: ${orderId}`);
      console.error(`[Full Payment] OrderId format: ${orderId}, length: ${orderId.length}`);
      
      // Thử query lại với các điều kiện khác
      const allTransactions = await PaymentTransaction.find({}).limit(5).sort({ createdAt: -1 });
      console.error(`[Full Payment] Recent transactions:`, allTransactions.map(t => ({ orderId: t.orderId, userId: t.userId })));
      
      // Nếu không tìm thấy, không thể xử lý vì không có userId
      return {
        success: false,
        responseCode: "99",
        orderId,
        message: `Không tìm thấy thông tin giao dịch cho orderId: ${orderId}. Vui lòng liên hệ hỗ trợ.`,
      };
    }

    if (existingTransaction) {
      if (existingTransaction.status === "SUCCESS") {
        return {
          success: true,
          responseCode: existingTransaction.responseCode,
          orderId,
          amount: existingTransaction.amount,
          userId: existingTransaction.userId,
          message: "Giao dịch đã được xử lý trước đó",
        };
      }
      // Nếu đã tồn tại với status PENDING, cập nhật thay vì tạo mới
      existingTransaction.status = responseCode === "00" ? "SUCCESS" : "FAILED";
      existingTransaction.responseCode = responseCode;
      existingTransaction.vnp_TransactionNo = vnp_TransactionNo;
      existingTransaction.processedAt = new Date();
      await existingTransaction.save();
      paymentTransaction = existingTransaction;
    } else {
      // Lưu transaction vào DB (trường hợp không tìm thấy - không nên xảy ra nếu đã lưu trước)
      paymentTransaction = await PaymentTransaction.create({
        orderId,
        userId,
        amount,
        status: responseCode === "00" ? "SUCCESS" : "FAILED",
        responseCode,
        vnp_TransactionNo,
        description: "Đặt cọc qua VNPay",
        processedAt: new Date(),
      });
    }

    if (responseCode === "00") {
      try {
        // Tìm depositRequestId từ DepositRequest (vì orderId giờ chỉ là số)
        let depositRequestId: string | null = null;
        // Tìm DepositRequest có status PENDING_PAYMENT và amount khớp
        const DepositRequest = (await import("../models/DepositRequest")).default;
        const depositRequest = await DepositRequest.findOne({
          buyerId: userId,
          depositAmount: amount,
          status: "PENDING_PAYMENT",
        }).sort({ createdAt: -1 }); // Lấy cái mới nhất
        
        if (depositRequest) {
          depositRequestId = depositRequest._id?.toString() || null;
        }

        // Chuyển tiền vào ví hệ thống (không nạp vào ví người dùng)
        await systemWalletService.deposit(
          amount,
          `Đặt cọc từ user ${userId}${depositRequestId ? ` (DepositRequest: ${depositRequestId})` : ""}`,
          "COMPLETED",
          depositRequestId || undefined,
          undefined
        );

        // Nếu có depositRequestId, cập nhật trạng thái
        if (depositRequestId) {
          const DepositRequest = (await import("../models/DepositRequest")).default;
          const depositRequest = await DepositRequest.findById(depositRequestId);
          if (depositRequest) {
            depositRequest.status = "PENDING_SELLER_CONFIRMATION";
            await depositRequest.save();
          }
        }

        console.log(
          `✅ [Deposit Payment] Transferred ${amount} VND from user ${userId} to system wallet. OrderId: ${orderId}`
        );

        return {
          success: true,
          responseCode,
          orderId,
          amount,
          userId,
          depositRequestId: depositRequestId || undefined,
          message: "Thanh toán đặt cọc thành công",
        };
      } catch (error: any) {
        console.error("❌ [Deposit Payment] Error processing payment:", error);

        paymentTransaction.status = "FAILED";
        await paymentTransaction.save();

        return {
          success: false,
          responseCode: "99",
          orderId,
          message: "Lỗi khi xử lý thanh toán: " + error.message,
        };
      }
    } else {
      return {
        success: false,
        responseCode,
        orderId,
        message: getVNPayMessage(responseCode),
      };
    }
  } else {
    return {
      success: false,
      responseCode: "97",
      orderId: vnp_Params["vnp_TxnRef"],
      message: "Chữ ký không hợp lệ",
    };
  }
};

/**
 * Xử lý callback VNPay cho số tiền còn lại
 * Nạp vào ví người dùng → chuyển vào ví hệ thống
 */
export const handleRemainingAmountPaymentReturn = async (vnp_Params: any) => {
  let secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash === signed) {
    let orderId = vnp_Params["vnp_TxnRef"];
    let responseCode = vnp_Params["vnp_ResponseCode"];
    let amount = parseInt(vnp_Params["vnp_Amount"]) / 100;
    let vnp_TransactionNo = vnp_Params["vnp_TransactionNo"];

    // Check xem giao dịch đã được xử lý chưa
    let existingTransaction = await PaymentTransaction.findOne({ orderId });
    let paymentTransaction: any;

    console.log(`[Full Payment] Looking for orderId: ${orderId}`);
    console.log(`[Full Payment] Found transaction:`, existingTransaction ? "YES" : "NO");

    // Lấy userId từ orderId (giống như nạp tiền vào ví)
    // Format: userId_timestamp_random
    let userId: string;
    if (orderId.includes("_")) {
      userId = orderId.split("_")[0];
      console.log(`[Full Payment] UserId extracted from orderId: ${userId}`);
    } else if (existingTransaction) {
      // Fallback: nếu orderId không có dấu gạch dưới, lấy từ PaymentTransaction
      userId = existingTransaction.userId;
      console.log(`[Full Payment] UserId from transaction: ${userId}`);
    } else {
      // Nếu không tìm thấy, log để debug
      console.error(`[Full Payment] ❌ Không thể lấy userId từ orderId: ${orderId}`);
      console.error(`[Full Payment] OrderId format: ${orderId}, length: ${orderId.length}`);
      
      // Thử query lại với các điều kiện khác
      const allTransactions = await PaymentTransaction.find({}).limit(5).sort({ createdAt: -1 });
      console.error(`[Full Payment] Recent transactions:`, allTransactions.map(t => ({ orderId: t.orderId, userId: t.userId })));
      
      // Nếu không tìm thấy, không thể xử lý vì không có userId
      return {
        success: false,
        responseCode: "99",
        orderId,
        message: `Không tìm thấy thông tin giao dịch cho orderId: ${orderId}. Vui lòng liên hệ hỗ trợ.`,
      };
    }

    if (existingTransaction) {
      if (existingTransaction.status === "SUCCESS") {
        return {
          success: true,
          responseCode: existingTransaction.responseCode,
          orderId,
          amount: existingTransaction.amount,
          userId: existingTransaction.userId,
          message: "Giao dịch đã được xử lý trước đó",
        };
      }
      // Nếu đã tồn tại với status PENDING, cập nhật thay vì tạo mới
      existingTransaction.status = responseCode === "00" ? "SUCCESS" : "FAILED";
      existingTransaction.responseCode = responseCode;
      existingTransaction.vnp_TransactionNo = vnp_TransactionNo;
      existingTransaction.processedAt = new Date();
      await existingTransaction.save();
      paymentTransaction = existingTransaction;
    } else {
      // Lưu transaction vào DB (trường hợp không tìm thấy - không nên xảy ra nếu đã lưu trước)
      paymentTransaction = await PaymentTransaction.create({
        orderId,
        userId,
        amount,
        status: responseCode === "00" ? "SUCCESS" : "FAILED",
        responseCode,
        vnp_TransactionNo,
        description: "Thanh toán số tiền còn lại qua VNPay",
        processedAt: new Date(),
      });
    }

    if (responseCode === "00") {
      try {
        // Bước 1: Nạp vào ví người dùng
        await walletService.deposit(
          userId,
          amount,
          "Nạp tiền thanh toán số tiền còn lại"
        );

        // Bước 2: Chuyển vào ví hệ thống
        await systemWalletService.deposit(
          amount,
          `Thanh toán số tiền còn lại từ user ${userId}`,
          "COMPLETED",
          undefined,
          undefined
        );

        // Bước 3: Trừ tiền từ ví người dùng (để không bị double)
        await walletService.withdraw(
          userId,
          amount,
          "Chuyển tiền thanh toán số tiền còn lại vào ví hệ thống"
        );

        console.log(
          `✅ [Remaining Payment] Transferred ${amount} VND from user ${userId} to system wallet. OrderId: ${orderId}`
        );

        return {
          success: true,
          responseCode,
          orderId,
          amount,
          userId,
          message: "Thanh toán số tiền còn lại thành công",
        };
      } catch (error: any) {
        console.error(
          "❌ [Remaining Payment] Error processing payment:",
          error
        );

        paymentTransaction.status = "FAILED";
        await paymentTransaction.save();

        return {
          success: false,
          responseCode: "99",
          orderId,
          message: "Lỗi khi xử lý thanh toán: " + error.message,
        };
      }
    } else {
      return {
        success: false,
        responseCode,
        orderId,
        message: getVNPayMessage(responseCode),
      };
    }
  } else {
    return {
      success: false,
      responseCode: "97",
      orderId: vnp_Params["vnp_TxnRef"],
      message: "Chữ ký không hợp lệ",
    };
  }
};

/**
 * Xử lý callback VNPay cho mua full
 * Nạp vào ví người dùng → chuyển vào ví hệ thống
 */
export const handleFullPaymentReturn = async (vnp_Params: any) => {
  try {
    console.log("[Full Payment] ===== Starting callback processing =====");
    console.log("[Full Payment] Received params:", JSON.stringify(vnp_Params, null, 2));
    
    let secureHash = vnp_Params["vnp_SecureHash"];

    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    vnp_Params = sortObject(vnp_Params);

    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
    let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    console.log("[Full Payment] SecureHash check:", secureHash === signed ? "PASS" : "FAIL");

    if (secureHash === signed) {
    let orderId = vnp_Params["vnp_TxnRef"];
    let responseCode = vnp_Params["vnp_ResponseCode"];
    let amount = parseInt(vnp_Params["vnp_Amount"]) / 100;
    let vnp_TransactionNo = vnp_Params["vnp_TransactionNo"];

    // Check xem giao dịch đã được xử lý chưa
    let existingTransaction = await PaymentTransaction.findOne({ orderId });
    let paymentTransaction: any;

    console.log(`[Full Payment] Looking for orderId: ${orderId}`);
    console.log(`[Full Payment] Found transaction:`, existingTransaction ? "YES" : "NO");

    // Lấy userId từ orderId (giống như nạp tiền vào ví)
    // Format: userId_timestamp_random
    let userId: string;
    if (orderId.includes("_")) {
      userId = orderId.split("_")[0];
      console.log(`[Full Payment] UserId extracted from orderId: ${userId}`);
    } else if (existingTransaction) {
      // Fallback: nếu orderId không có dấu gạch dưới, lấy từ PaymentTransaction
      userId = existingTransaction.userId;
      console.log(`[Full Payment] UserId from transaction: ${userId}`);
    } else {
      // Nếu không tìm thấy, log để debug
      console.error(`[Full Payment] ❌ Không thể lấy userId từ orderId: ${orderId}`);
      console.error(`[Full Payment] OrderId format: ${orderId}, length: ${orderId.length}`);
      
      // Thử query lại với các điều kiện khác
      const allTransactions = await PaymentTransaction.find({}).limit(5).sort({ createdAt: -1 });
      console.error(`[Full Payment] Recent transactions:`, allTransactions.map(t => ({ orderId: t.orderId, userId: t.userId })));
      
      // Nếu không tìm thấy, không thể xử lý vì không có userId
      return {
        success: false,
        responseCode: "99",
        orderId,
        message: `Không tìm thấy thông tin giao dịch cho orderId: ${orderId}. Vui lòng liên hệ hỗ trợ.`,
      };
    }

    if (existingTransaction) {
      if (existingTransaction.status === "SUCCESS") {
        return {
          success: true,
          responseCode: existingTransaction.responseCode,
          orderId,
          amount: existingTransaction.amount,
          userId: existingTransaction.userId,
          message: "Giao dịch đã được xử lý trước đó",
        };
      }
      // Nếu đã tồn tại với status PENDING, cập nhật thay vì tạo mới
      existingTransaction.status = responseCode === "00" ? "SUCCESS" : "FAILED";
      existingTransaction.responseCode = responseCode;
      existingTransaction.vnp_TransactionNo = vnp_TransactionNo;
      existingTransaction.processedAt = new Date();
      await existingTransaction.save();
      paymentTransaction = existingTransaction;
    } else {
      // Lưu transaction vào DB (trường hợp không tìm thấy - không nên xảy ra nếu đã lưu trước)
      paymentTransaction = await PaymentTransaction.create({
        orderId,
        userId,
        amount,
        status: responseCode === "00" ? "SUCCESS" : "FAILED",
        responseCode,
        vnp_TransactionNo,
        description: "Thanh toán toàn bộ qua VNPay",
        processedAt: new Date(),
      });
    }

    if (responseCode === "00") {
      try {
        // Bước 1: Nạp vào ví người dùng
        await walletService.deposit(
          userId,
          amount,
          "Nạp tiền thanh toán toàn bộ"
        );

        // Bước 2: Chuyển vào ví hệ thống
        await systemWalletService.deposit(
          amount,
          `Thanh toán toàn bộ từ user ${userId}`,
          "COMPLETED",
          undefined,
          undefined
        );

        // Bước 3: Trừ tiền từ ví người dùng (để không bị double)
        await walletService.withdraw(
          userId,
          amount,
          "Chuyển tiền thanh toán toàn bộ vào ví hệ thống"
        );

        console.log(
          `✅ [Full Payment] Transferred ${amount} VND from user ${userId} to system wallet. OrderId: ${orderId}`
        );

        // Cập nhật listing status = "Sold" nếu có listingId
        let listing: any = null;
        if (paymentTransaction.listingId) {
          try {
            listing = await Listing.findById(paymentTransaction.listingId);
            if (listing) {
              // Kiểm tra listing chưa bán
              if (listing.status !== "Sold") {
                listing.status = "Sold";
                await listing.save();
                console.log(
                  `✅ [Full Payment] Updated listing ${paymentTransaction.listingId} status to "Sold"`
                );
              } else {
                console.log(
                  `⚠️ [Full Payment] Listing ${paymentTransaction.listingId} already sold`
                );
              }
            } else {
              console.error(
                `❌ [Full Payment] Listing ${paymentTransaction.listingId} not found`
              );
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
            `⚠️ [Full Payment] No listingId in payment transaction, skipping listing update`
          );
        }

        // [FULL_PAYMENT_APPOINTMENT] - Tạo Appointment và DepositRequest để hiển thị trong Transaction History
        // START: Code mới thêm - có thể revert bằng cách xóa từ đây đến END
        if (paymentTransaction.listingId && listing) {
          try {
            // Đảm bảo sellerId là string
            const sellerId = listing.sellerId?.toString() || (listing.sellerId as any)?.toString() || String(listing.sellerId);
            // Đảm bảo userId là string
            const buyerIdStr = String(userId);
            
            console.log(`[Full Payment] Creating Appointment - buyerId: ${buyerIdStr}, sellerId: ${sellerId}, listingId: ${paymentTransaction.listingId}`);
            
            // Tạo DepositRequest với depositAmount = 0 để Transaction History có thể lấy listingId
            const depositRequest = await DepositRequest.create({
              listingId: String(paymentTransaction.listingId),
              buyerId: buyerIdStr,
              sellerId: sellerId,
              depositAmount: 0, // Thanh toán toàn bộ nên không có đặt cọc
              status: "COMPLETED", // Đã thanh toán toàn bộ
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
            });

            console.log(
              `✅ [Full Payment] Created DepositRequest ${depositRequest._id} for Transaction History (buyerId: ${buyerIdStr}, sellerId: ${sellerId})`
            );

            // Tạo Appointment với status = "COMPLETED" để hiển thị trong Transaction History
            const appointment = await Appointment.create({
              depositRequestId: depositRequest._id.toString(),
              appointmentType: "NORMAL_DEPOSIT",
              buyerId: buyerIdStr,
              sellerId: sellerId,
              createdBy: "BUYER",
              scheduledDate: new Date(), // Ngày thanh toán
              status: "COMPLETED", // Đã thanh toán toàn bộ
              type: "DELIVERY",
              buyerConfirmed: true,
              sellerConfirmed: true,
              buyerConfirmedAt: new Date(),
              sellerConfirmedAt: new Date(),
              confirmedAt: new Date(),
              completedAt: new Date(),
            });

            console.log(
              `✅ [Full Payment] Created Appointment ${appointment._id} for Transaction History (buyerId: ${buyerIdStr}, sellerId: ${sellerId}, status: COMPLETED)`
            );
          } catch (appointmentError: any) {
            console.error(
              `❌ [Full Payment] Error creating Appointment/DepositRequest:`,
              appointmentError.message
            );
            console.error(
              `❌ [Full Payment] Error stack:`,
              appointmentError.stack
            );
            // Không throw error vì thanh toán đã thành công, chỉ log
          }
        } else {
          console.log(
            `⚠️ [Full Payment] No listingId or listing not found, skipping Appointment creation. listingId: ${paymentTransaction.listingId}, listing: ${listing ? 'exists' : 'null'}`
          );
        }
        // END: Code mới thêm

        return {
          success: true,
          responseCode,
          orderId,
          amount,
          userId,
          listingId: paymentTransaction.listingId || undefined,
          message: "Thanh toán toàn bộ thành công",
        };
      } catch (error: any) {
        console.error("❌ [Full Payment] Error processing payment:", error);

        paymentTransaction.status = "FAILED";
        await paymentTransaction.save();

        return {
          success: false,
          responseCode: "99",
          orderId,
          message: "Lỗi khi xử lý thanh toán: " + error.message,
        };
      }
    } else {
      return {
        success: false,
        responseCode,
        orderId,
        message: getVNPayMessage(responseCode),
      };
    }
  } else {
    console.error("[Full Payment] ❌ Chữ ký không hợp lệ");
    return {
      success: false,
      responseCode: "97",
      orderId: vnp_Params["vnp_TxnRef"],
      message: "Chữ ký không hợp lệ",
    };
  }
  } catch (error: any) {
    console.error("[Full Payment] ❌❌❌ UNEXPECTED ERROR:", error);
    console.error("[Full Payment] Error stack:", error.stack);
    return {
      success: false,
      responseCode: "99",
      orderId: vnp_Params?.["vnp_TxnRef"] || "UNKNOWN",
      message: `Lỗi hệ thống: ${error.message || "Unknown error"}`,
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

