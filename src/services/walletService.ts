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
    wallet.totalDeposited += amount; // ✅ Chỉ tăng khi nạp tiền từ bên ngoài (VNPay)
    wallet.lastTransactionAt = new Date();
    await wallet.save();
    return wallet;
  },

  // ✅ Refund - hoàn tiền về ví (KHÔNG tăng totalDeposited, nhưng tăng totalRefunded)
  refund: async (userId: string, amount: number, description?: string) => {
    const wallet = await walletService.getWallet(userId);
    wallet.balance += amount;
    wallet.totalRefunded = (wallet.totalRefunded || 0) + amount; // ✅ Tăng totalRefunded
    // ✅ KHÔNG tăng totalDeposited vì đây là tiền hoàn lại từ escrow, không phải nạp mới
    wallet.lastTransactionAt = new Date();
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

  // Freeze amount - đóng băng tiền khi đặt cọc
  freezeAmount: async (userId: string, amount: number, description?: string) => {
    const wallet = await walletService.getWallet(userId);
    if (wallet.balance < amount) {
      throw new Error("Số dư không đủ để đóng băng");
    }
    
    wallet.balance -= amount;
    wallet.frozenAmount = (wallet.frozenAmount || 0) + amount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();
    
    console.log(`✅ Frozen ${amount} VND for user ${userId}. Description: ${description}`);
    return wallet;
  },

  // Unfreeze amount - hủy đóng băng tiền
  unfreezeAmount: async (userId: string, amount: number, description?: string) => {
    const wallet = await walletService.getWallet(userId);
    if ((wallet.frozenAmount || 0) < amount) {
      throw new Error("Không có tiền đang bị đóng băng");
    }
    
    wallet.balance += amount;
    wallet.frozenAmount = (wallet.frozenAmount || 0) - amount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();
    
    console.log(`✅ Unfrozed ${amount} VND for user ${userId}. Description: ${description}`);
    return wallet;
  },

  // Transfer to escrow - chuyển tiền từ frozen vào escrow
  transferToEscrow: async (depositRequestId: string) => {
    const DepositRequest = (await import('../models/DepositRequest')).default;
    const EscrowAccount = (await import('../models/EscrowAccount')).default;
    
    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      throw new Error("Không tìm thấy yêu cầu đặt cọc");
    }

    // Unfreeze và chuyển vào escrow
    const wallet = await walletService.getWallet(depositRequest.buyerId);
    if (wallet.frozenAmount < depositRequest.depositAmount) {
      throw new Error("Không đủ tiền đang bị đóng băng");
    }
    
    wallet.frozenAmount -= depositRequest.depositAmount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();

    // Chuyển vào escrow
    let escrow = await EscrowAccount.findOne({ depositRequestId });
    if (!escrow) {
      escrow = new EscrowAccount({
        depositRequestId,
        buyerId: depositRequest.buyerId,
        sellerId: depositRequest.sellerId,
        listingId: depositRequest.listingId,
        amount: depositRequest.depositAmount,
        status: "ACTIVE"
      });
    } else {
      escrow.amount = depositRequest.depositAmount;
      escrow.status = "ACTIVE";
    }

    await escrow.save();

    // Cập nhật trạng thái deposit request
    depositRequest.status = 'IN_ESCROW';
    await depositRequest.save();

    console.log(`✅ Transferred ${depositRequest.depositAmount} VND to escrow for deposit ${depositRequestId}`);

    return { escrow };
  },

  // Refund from escrow - hoàn tiền từ escrow về ví (100%)
  refundFromEscrow: async (depositRequestId: string) => {
    const DepositRequest = (await import('../models/DepositRequest')).default;
    const EscrowAccount = (await import('../models/EscrowAccount')).default;
    
    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      throw new Error("Không tìm thấy yêu cầu đặt cọc");
    }

    // Lấy escrow
    const escrow = await EscrowAccount.findOne({ depositRequestId });

    if (escrow && escrow.status === "ACTIVE") {
      // ✅ Hoàn tiền về ví buyer (100%) - dùng refund() thay vì deposit() để không tăng totalDeposited
      await walletService.refund(
        depositRequest.buyerId,
        depositRequest.depositAmount,
        "Hoàn tiền từ escrow"
      );

      // Cập nhật escrow
      escrow.status = "REFUNDED";
      escrow.refundedAt = new Date();
      await escrow.save();

      console.log(`✅ Refunded ${depositRequest.depositAmount} VND from escrow to buyer ${depositRequest.buyerId}`);
    }

    return escrow;
  },

  // Refund from escrow with cancellation fee - hoàn tiền với phí hủy (80% tiền đặt cọc về buyer, 20% về system)
  refundFromEscrowWithCancellationFee: async (depositRequestId: string) => {
    const DepositRequest = (await import('../models/DepositRequest')).default;
    const EscrowAccount = (await import('../models/EscrowAccount')).default;
    const SystemWalletService = (await import('./systemWalletService')).default;
    
    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      throw new Error("Không tìm thấy yêu cầu đặt cọc");
    }

    // Lấy escrow
    const escrow = await EscrowAccount.findOne({ depositRequestId });

    if (escrow && escrow.status === "ACTIVE") {
      const totalAmount = depositRequest.depositAmount; // Tiền đặt cọc (10% giá xe)
      const refundToBuyer = Math.round(totalAmount * 0.8); // 80% tiền đặt cọc = 8% giá xe về buyer
      const feeToSystem = totalAmount - refundToBuyer; // 20% tiền đặt cọc = 2% giá xe về system

      // ✅ Hoàn 80% tiền đặt cọc (8% giá xe) về ví buyer - dùng refund() để không tăng totalDeposited
      await walletService.refund(
        depositRequest.buyerId,
        refundToBuyer,
        `Hoàn tiền từ escrow (80% tiền đặt cọc - phí hủy 20%)`
      );

      // Chuyển 20% tiền đặt cọc (2% giá xe) phí hủy vào ví hệ thống
      await SystemWalletService.deposit(
        feeToSystem,
        `Phí hủy giao dịch từ deposit ${depositRequestId} (20% tiền đặt cọc)`
      );

      // Cập nhật escrow
      escrow.status = "REFUNDED";
      escrow.refundedAt = new Date();
      await escrow.save();

      console.log(`✅ Refunded ${refundToBuyer} VND (80% tiền đặt cọc = 8% giá xe) to buyer ${depositRequest.buyerId}`);
      console.log(`💰 Cancellation fee ${feeToSystem} VND (20% tiền đặt cọc = 2% giá xe) to system wallet`);
    }

    return escrow;
  },

  // Complete transaction - hoàn thành giao dịch, chuyển tiền từ escrow vào ví hệ thống
  completeTransaction: async (depositRequestId: string) => {
    const DepositRequest = (await import('../models/DepositRequest')).default;
    const EscrowAccount = (await import('../models/EscrowAccount')).default;
    const SystemWalletService = (await import('./systemWalletService')).default;
    
    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      throw new Error("Không tìm thấy yêu cầu đặt cọc");
    }

    // Lấy escrow
    const escrow = await EscrowAccount.findOne({ depositRequestId });

    if (!escrow) {
      throw new Error("Không tìm thấy tài khoản escrow");
    }

    if (escrow.status === "ACTIVE") {
      // Cập nhật totalSpent cho buyer (tiền đã dùng để mua hàng - giao dịch hoàn thành)
      const wallet = await walletService.getWallet(depositRequest.buyerId);
      wallet.totalSpent = (wallet.totalSpent || 0) + depositRequest.depositAmount; // ✅ Tăng totalSpent khi giao dịch hoàn thành
      wallet.lastTransactionAt = new Date();
      await wallet.save();

      // Chuyển tiền từ escrow vào ví hệ thống
      await SystemWalletService.deposit(
        depositRequest.depositAmount,
        `Nhận tiền từ giao dịch đặt cọc ${depositRequestId}`
      );

      // Cập nhật escrow
      escrow.status = "RELEASED";
      escrow.releasedAt = new Date();
      await escrow.save();

      console.log(`✅ Released ${depositRequest.depositAmount} VND from escrow to system wallet`);
      console.log(`💰 Updated totalSpent for buyer ${depositRequest.buyerId}: +${depositRequest.depositAmount} VND`);
    }

    return escrow;
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
