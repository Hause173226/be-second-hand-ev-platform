import crypto from "crypto";
import querystring from "qs";
import { VNPayConfig } from "../config/vnpay";
import walletService from "./walletService";

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

  console.log("=== VNPay Return Verification ===");
  console.log("Sign Data:", signData);
  console.log("Received Hash:", secureHash);
  console.log("Calculated Hash:", signed);
  console.log("Match:", secureHash === signed);

  if (secureHash === signed) {
    let orderId = vnp_Params["vnp_TxnRef"];
    let responseCode = vnp_Params["vnp_ResponseCode"];
    let amount = parseInt(vnp_Params["vnp_Amount"]) / 100;

    const userId = orderId.split("_")[0];

    if (responseCode === "00") {
      try {
        await walletService.deposit(userId, amount, "Nạp tiền qua VNPay");

        console.log(`✅ Deposited ${amount} VND to wallet of user ${userId}`);

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
    return { RspCode: "00", Message: "Success" };
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
