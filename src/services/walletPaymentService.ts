import crypto from "crypto";
import querystring from "qs";
import { VNPayConfig } from "../config/vnpay";
import walletService from "./walletService";
import PaymentTransaction from "../models/PaymentTransaction";

// GIỐNG Y CHANG paymentService.ts
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

export const handleVNPayReturn = async (vnp_Params: any) => {
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

    const userId = orderId.split("_")[0];

    // ✅ Check xem giao dịch đã được xử lý chưa
    let existingTransaction = await PaymentTransaction.findOne({ orderId });

    if (existingTransaction) {
      console.log(`⚠️ Transaction ${orderId} already processed. Status: ${existingTransaction.status}`);
      
      if (existingTransaction.status === "SUCCESS") {
        return {
          success: true,
          responseCode: existingTransaction.responseCode,
          orderId,
          amount: existingTransaction.amount,
          userId: existingTransaction.userId,
          message: "Giao dịch đã được xử lý trước đó",
        };
      } else {
        return {
          success: false,
          responseCode: existingTransaction.responseCode,
          orderId,
          message: getVNPayMessage(existingTransaction.responseCode),
        };
      }
    }

    // ✅ Lưu transaction vào DB
    const paymentTransaction = await PaymentTransaction.create({
      orderId,
      userId,
      amount,
      status: responseCode === "00" ? "SUCCESS" : "FAILED",
      responseCode,
      vnp_TransactionNo,
      description: "Nạp tiền qua VNPay",
      processedAt: new Date(),
    });

    if (responseCode === "00") {
      try {
        // ✅ Chỉ cộng tiền nếu chưa xử lý
        await walletService.deposit(userId, amount, "Nạp tiền qua VNPay");

        console.log(`✅ Deposited ${amount} VND to wallet of user ${userId}. OrderId: ${orderId}`);

        return {
          success: true,
          responseCode,
          orderId,
          amount,
          userId,
          message: "Thanh toán thành công",
        };
      } catch (error: any) {
        console.error("❌ Error depositing to wallet:", error);
        
        // ✅ Cập nhật status thành FAILED nếu có lỗi
        paymentTransaction.status = "FAILED";
        await paymentTransaction.save();

        return {
          success: false,
          responseCode: "99",
          orderId,
          message: "Lỗi khi nạp tiền vào ví: " + error.message,
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

export const handleVNPayCallback = async (vnp_Params: any) => {
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

    // ✅ Chỉ xử lý nếu responseCode = "00" (thành công)
    if (responseCode === "00") {
      const userId = orderId.split("_")[0];

      // ✅ Check xem giao dịch đã được xử lý chưa
      let existingTransaction = await PaymentTransaction.findOne({ orderId });

      if (!existingTransaction) {
        // ✅ Nếu chưa có trong DB, tạo mới và cộng tiền
        try {
          const paymentTransaction = await PaymentTransaction.create({
            orderId,
            userId,
            amount,
            status: "SUCCESS",
            responseCode,
            vnp_TransactionNo,
            description: "Nạp tiền qua VNPay (IPN)",
            processedAt: new Date(),
          });

          await walletService.deposit(userId, amount, "Nạp tiền qua VNPay");

          console.log(`✅ [IPN] Deposited ${amount} VND to wallet of user ${userId}. OrderId: ${orderId}`);

          return { RspCode: "00", Message: "Success" };
        } catch (error: any) {
          console.error("❌ [IPN] Error processing transaction:", error);
          return { RspCode: "99", Message: "Internal Error" };
        }
      } else if (existingTransaction.status !== "SUCCESS") {
        // ✅ Nếu đã có nhưng chưa thành công, cập nhật và cộng tiền
        try {
          existingTransaction.status = "SUCCESS";
          existingTransaction.responseCode = responseCode;
          existingTransaction.vnp_TransactionNo = vnp_TransactionNo;
          existingTransaction.processedAt = new Date();
          await existingTransaction.save();

          await walletService.deposit(userId, amount, "Nạp tiền qua VNPay");

          console.log(`✅ [IPN] Deposited ${amount} VND to wallet of user ${userId}. OrderId: ${orderId}`);

          return { RspCode: "00", Message: "Success" };
        } catch (error: any) {
          console.error("❌ [IPN] Error processing transaction:", error);
          return { RspCode: "99", Message: "Internal Error" };
        }
      } else {
        // ✅ Đã xử lý rồi, chỉ trả về success
        console.log(`ℹ️ [IPN] Transaction ${orderId} already processed`);
        return { RspCode: "00", Message: "Success" };
      }
    } else {
      // ✅ Giao dịch không thành công, chỉ lưu vào DB
      const userId = orderId.split("_")[0];
      let existingTransaction = await PaymentTransaction.findOne({ orderId });

      if (!existingTransaction) {
        await PaymentTransaction.create({
          orderId,
          userId,
          amount,
          status: "FAILED",
          responseCode,
          vnp_TransactionNo,
          description: "Nạp tiền qua VNPay (IPN) - Failed",
          processedAt: new Date(),
        });
      }

      return { RspCode: "00", Message: "Success" }; // Vẫn trả về success cho VNPay
    }
  } else {
    return { RspCode: "97", Message: "Invalid Signature" };
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
