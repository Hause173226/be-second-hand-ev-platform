import { Request, Response } from "express";
import {
  handleVNPayReturn as handleWalletVNPayReturn,
  handleVNPayCallback as handleWalletVNPayCallback,
} from "../services/walletPaymentService";
import {
  handleDepositPaymentReturn,
  handleRemainingAmountPaymentReturn,
  handleFullPaymentReturn,
} from "../services/depositPaymentService";

// Handler cho Wallet VNPay Return
export const walletVNPayReturn = async (req: Request, res: Response) => {
  try {
    console.log("=== Wallet VNPay Return Called ===");
    console.log("Query params:", req.query);

    const result = await handleWalletVNPayReturn(req.query);

    console.log("=== Result ===", result);

    if (result.success) {
      // Redirect về frontend success page
      res.redirect(
        `http://localhost:5173/wallet?success=true&amount=${result.amount}&orderId=${result.orderId}`
      );
    } else {
      let message = "Thanh toán thất bại";

      switch (result.responseCode) {
        case "24":
          message = "Giao dịch đã bị hủy bởi người dùng";
          break;
        case "51":
          message = "Tài khoản không đủ số dư";
          break;
        case "97":
          message = "Chữ ký không hợp lệ";
          break;
        case "99":
          message = "Lỗi hệ thống";
          break;
        default:
          message = `Thanh toán thất bại. Mã lỗi: ${result.responseCode}`;
      }

      res.redirect(
        `http://localhost:5173/wallet?success=false&message=${encodeURIComponent(
          message
        )}&code=${result.responseCode}`
      );
    }
  } catch (error: any) {
    console.error("❌ Wallet VNPay return error:", error);
    res.redirect(
      `http://localhost:5173/wallet?success=false&message=${encodeURIComponent(
        "Có lỗi xảy ra: " + error.message
      )}`
    );
  }
};

// Handler cho Wallet VNPay Callback (IPN)
export const walletVNPayCallback = async (req: Request, res: Response) => {
  try {
    console.log("=== Wallet VNPay Callback Called ===");
    console.log("Query params:", req.query);

    const result = await handleWalletVNPayCallback(req.query);
    res.status(200).json({
      RspCode: result.RspCode,
      Message: result.Message,
    });
  } catch (error: any) {
    console.error("❌ Wallet VNPay callback error:", error);
    res.status(200).json({
      RspCode: "99",
      Message: "Internal Error",
    });
  }
};

// Handler cho Deposit Payment Return
export const depositVNPayReturn = async (req: Request, res: Response) => {
  try {
    console.log("=== Deposit VNPay Return Called ===");
    console.log("Query params:", req.query);

    const result = await handleDepositPaymentReturn(req.query);

    if (result.success) {
      res.redirect(
        `http://localhost:5173/deposits?success=true&amount=${result.amount}&orderId=${result.orderId}`
      );
    } else {
      let message = "Thanh toán thất bại";
      switch (result.responseCode) {
        case "24":
          message = "Giao dịch đã bị hủy bởi người dùng";
          break;
        case "51":
          message = "Tài khoản không đủ số dư";
          break;
        case "97":
          message = "Chữ ký không hợp lệ";
          break;
        case "99":
          message = "Lỗi hệ thống";
          break;
        default:
          message = `Thanh toán thất bại. Mã lỗi: ${result.responseCode}`;
      }

      res.redirect(
        `http://localhost:5173/deposits?success=false&message=${encodeURIComponent(
          message
        )}&code=${result.responseCode}`
      );
    }
  } catch (error: any) {
    console.error("❌ Deposit VNPay return error:", error);
    res.redirect(
      `http://localhost:5173/deposits?success=false&message=${encodeURIComponent(
        "Có lỗi xảy ra: " + error.message
      )}`
    );
  }
};

// Handler cho Remaining Amount Payment Return
export const remainingAmountVNPayReturn = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("=== Remaining Amount VNPay Return Called ===");
    console.log("Query params:", req.query);

    const result = await handleRemainingAmountPaymentReturn(req.query);

    if (result.success) {
      res.redirect(
        `http://localhost:5173/payments?success=true&amount=${result.amount}&orderId=${result.orderId}&type=remaining`
      );
    } else {
      let message = "Thanh toán thất bại";
      switch (result.responseCode) {
        case "24":
          message = "Giao dịch đã bị hủy bởi người dùng";
          break;
        case "51":
          message = "Tài khoản không đủ số dư";
          break;
        case "97":
          message = "Chữ ký không hợp lệ";
          break;
        case "99":
          message = "Lỗi hệ thống";
          break;
        default:
          message = `Thanh toán thất bại. Mã lỗi: ${result.responseCode}`;
      }

      res.redirect(
        `http://localhost:5173/payments?success=false&message=${encodeURIComponent(
          message
        )}&code=${result.responseCode}&type=remaining`
      );
    }
  } catch (error: any) {
    console.error("❌ Remaining Amount VNPay return error:", error);
    res.redirect(
      `http://localhost:5173/payments?success=false&message=${encodeURIComponent(
        "Có lỗi xảy ra: " + error.message
      )}&type=remaining`
    );
  }
};

// Handler cho Full Payment Return
export const fullPaymentVNPayReturn = async (req: Request, res: Response) => {
  try {
    console.log("=== Full Payment VNPay Return Called ===");
    console.log("Query params:", req.query);

    const result = await handleFullPaymentReturn(req.query);

    if (result.success) {
      res.redirect(
        `http://localhost:5173/payments?success=true&amount=${result.amount}&orderId=${result.orderId}&type=full`
      );
    } else {
      // Sử dụng message từ result nếu có, nếu không thì dùng message mặc định
      let message = result.message || "Thanh toán thất bại";
      
      // Chỉ override message nếu không có message từ result
      if (!result.message) {
        switch (result.responseCode) {
          case "24":
            message = "Giao dịch đã bị hủy bởi người dùng";
            break;
          case "51":
            message = "Tài khoản không đủ số dư";
            break;
          case "97":
            message = "Chữ ký không hợp lệ";
            break;
          case "99":
            message = "Lỗi hệ thống";
            break;
          default:
            message = `Thanh toán thất bại. Mã lỗi: ${result.responseCode}`;
        }
      }

      res.redirect(
        `http://localhost:5173/payments?success=false&message=${encodeURIComponent(
          message
        )}&code=${result.responseCode}&type=full`
      );
    }
  } catch (error: any) {
    console.error("❌ Full Payment VNPay return error:", error);
    res.redirect(
      `http://localhost:5173/payments?success=false&message=${encodeURIComponent(
        "Có lỗi xảy ra: " + error.message
      )}&type=full`
    );
  }
};
