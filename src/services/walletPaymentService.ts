import crypto from "crypto";
import moment from "moment";
import querystring from "qs";
import { Request } from "express";
import { VNPayConfig } from "../config/vnpay";

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

// Tạo URL thanh toán VNPay cho nạp tiền ví
export const createVNPayOrder = async (
  amount: number,
  userId: string,
  description: string,
  req: Request
) => {
  process.env.TZ = "Asia/Ho_Chi_Minh";

  let date = new Date();
  let createDate = moment(date).format("YYYYMMDDHHmmss");

  let ipAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection as any).socket?.remoteAddress;

  let orderId = moment(date).format("DDHHmmss");
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
  vnp_Params["vnp_OrderInfo"] = `Nạp tiền ví - ${description} - User: ${userId}`;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = amount * 100;
  vnp_Params["vnp_ReturnUrl"] = VNPayConfig.vnp_ReturnUrl;
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

  return {
    paymentUrl: vnpUrl,
    orderId: orderId,
    userId: userId,
    amount: amount
  };
};

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

    if (responseCode === "00") {
      // Thanh toán thành công
      return { 
        success: true, 
        responseCode, 
        orderId, 
        amount,
        message: "Thanh toán thành công"
      };
    } else {
      // Thanh toán thất bại
      return { 
        success: false, 
        responseCode, 
        orderId, 
        amount,
        message: "Thanh toán thất bại"
      };
    }
  } else {
    return {
      success: false,
      responseCode: "97",
      orderId: vnp_Params["vnp_TxnRef"],
      message: "Chữ ký không hợp lệ"
    };
  }
};

export const handleVNPayCallback = async (vnp_Params: any) => {
  let secureHash = vnp_Params["vnp_SecureHash"];
  let orderId = vnp_Params["vnp_TxnRef"];
  let rspCode = vnp_Params["vnp_ResponseCode"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash === signed) {
    let amount = parseInt(vnp_Params["vnp_Amount"]) / 100;

    if (rspCode === "00") {
      // Thanh toán thành công
      return { RspCode: "00", Message: "Success", orderId, amount };
    } else {
      // Thanh toán thất bại
      return { RspCode: "00", Message: "Failed", orderId, amount };
    }
  } else {
    return { RspCode: "97", Message: "Checksum failed" };
  }
};