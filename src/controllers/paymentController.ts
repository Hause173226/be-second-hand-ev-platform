import { Request, Response } from "express";
import {
  createVNPayOrder,
  handleVNPayReturn,
  handleVNPayCallback,
} from "../services/walletPaymentService";
import walletService from "../services/walletService";

// Tạo thanh toán VNPay cho nạp tiền ví
export const createVNPayPayment = async (req: Request, res: Response) => {
  try {
    const { amount, description } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    const vnpayUrl = await walletService.createDepositUrl(userId, amount, description, req);
    
    res.json({
      success: true,
      payUrl: vnpayUrl,
      message: 'Tạo link thanh toán thành công'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Tạo scheduled job để tự động hủy booking quá hạn
// export const cancelExpiredBookings = async () => {
//   const expiredTime = new Date();
//   expiredTime.setHours(expiredTime.getHours() - 24); // 24h ago

//   await Booking.updateMany(
//     {
//       bookingStatus: "pending",
//       paymentStatus: "unpaid",
//       createdAt: { $lt: expiredTime },
//     },
//     {
//       bookingStatus: "cancelled",
//       paymentStatus: "failed",
//     }
//   );
// };

export const vnpayReturn = async (req: Request, res: Response) => {
  try {
    const result = await handleVNPayReturn(req.query);

    if (result.success) {
      // Nạp tiền vào ví nếu thanh toán thành công
      // Lấy userId từ orderId (format: DDHHmmss)
      const userId = result.userId; // Cần lưu userId khi tạo order
      await walletService.deposit(
        userId,
        result.amount || 0,
        'Nạp tiền qua VNPay'
      );
      
      res.redirect(
        `http://localhost:5173/wallet?success=true&amount=${result.amount}`
      );
    } else {
      res.redirect(
        `http://localhost:5173/wallet?success=false&message=${encodeURIComponent(result.message || 'Thanh toán thất bại')}`
      );
    }
  } catch (error: any) {
    console.error("VNPay return error:", error);
    res.redirect(
      `http://localhost:3000/wallet?success=false&message=${encodeURIComponent("Có lỗi xảy ra")}`
    );
  }
};

export const vnpayCallback = async (req: Request, res: Response) => {
  try {
    const result = await handleVNPayCallback(req.query);
    
    if (result.RspCode === "00") {
      // Nạp tiền vào ví nếu thanh toán thành công
      const userId = result.userId; // Cần lưu userId khi tạo order
      await walletService.deposit(
        userId,
        result.amount || 0,
        'Nạp tiền qua VNPay'
      );
    }
    
    res.status(200).json({
      RspCode: result.RspCode,
      Message: result.Message,
    });
  } catch (error: any) {
    console.error("VNPay callback error:", error);
    res.status(200).json({
      RspCode: "99",
      Message: "Internal Error",
    });
  }
};

// Xử lý thanh toán thành công
export const paymentSuccess = async (req: Request, res: Response) => {
  try {
    const { orderId, amount } = req.query;
    
    res.json({
      success: true,
      message: 'Thanh toán thành công',
      orderId,
      amount
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
