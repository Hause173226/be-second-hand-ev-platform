import crypto from "crypto";
import moment from "moment";
import querystring from "qs";
import { Request } from "express";
import Wallet from "../models/Wallet";
import { VNPayConfig } from "../config/vnpay";

// Helper function để sort object (GIỐNG CODE CŨ)
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

const walletService = {
  getWallet: async (userId: string) => {
    let wallet = await Wallet.findOne({ userId: userId }); // ✅ SỬA: user → userId
    if (!wallet) {
      wallet = await Wallet.create({
        userId: userId, // ✅ SỬA: user → userId
        balance: 0,
        currency: "VND",
      });
    }
    return wallet;
  },

  deposit: async (userId: string, amount: number, description?: string) => {
    const wallet = await walletService.getWallet(userId);
    wallet.balance += amount;
    wallet.totalDeposited += amount; // ✅ THÊM: cập nhật totalDeposited
    wallet.lastTransactionAt = new Date(); // ✅ THÊM: cập nhật lastTransactionAt
    await wallet.save();
    return wallet;
  },

  withdraw: async (userId: string, amount: number, description?: string) => {
    const wallet = await walletService.getWallet(userId);
    if (wallet.balance < amount) {
      throw new Error("Số dư không đủ");
    }
    wallet.balance -= amount;
    wallet.totalWithdrawn += amount; // ✅ THÊM: cập nhật totalWithdrawn
    wallet.lastTransactionAt = new Date(); // ✅ THÊM: cập nhật lastTransactionAt
    await wallet.save();
    return wallet;
  },

  createDepositUrl: async (
    userId: string,
    amount: number,
    description: string,
    req: Request
  ) => {
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

    let orderId = `${userId}_${moment(date).format("DDHHmmss")}`;
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
    vnp_Params["vnp_ReturnUrl"] = VNPayConfig.vnp_WalletReturnUrl;
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

    console.log("=== VNPay Payment URL Created ===");
    console.log("User ID:", userId);
    console.log("Amount:", amount, "VND");
    console.log("Order ID:", orderId);
    console.log("Sign Data:", signData);
    console.log("Secure Hash:", signed);
    console.log("==================================");

    return vnpUrl;
  },
};

export default walletService;
