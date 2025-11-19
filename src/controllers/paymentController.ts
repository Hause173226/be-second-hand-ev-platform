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
import {
  handleDeposit10Callback as handleAppointmentDeposit10Callback,
  handleFullPaymentCallback as handleAppointmentFullPaymentCallback,
  handleRemaining90Callback as handleAppointmentRemaining90Callback,
  handleDeposit10Return as handleAppointmentDeposit10Return,
  handleFullPaymentReturn as handleAppointmentFullPaymentReturn,
  handleRemaining90Return as handleAppointmentRemaining90Return,
} from "../services/appointmentDepositPaymentService";

// Handler cho Wallet VNPay Return (cũng xử lý appointment payments vì dùng chung Return URL)
export const walletVNPayReturn = async (req: Request, res: Response) => {
  try {
    console.log("=== VNPay Return Called ===");
    console.log("Query params:", req.query);

    const vnpOrderId = req.query.vnp_TxnRef as string;

    // Phân biệt wallet payment và appointment payment bằng vnpOrderId format
    // Wallet: userId_timestamp (không có prefix)
    // Appointment deposit: appointmentIdShort_timestamp
    // Appointment full: FULL_appointmentIdShort_timestamp
    // Appointment remaining: REM_appointmentIdShort_timestamp

    if (vnpOrderId?.startsWith("FULL_")) {
      // Appointment full payment 100%
      console.log("→ Routing to Appointment Full Payment Return");
      return await appointmentFullPaymentReturn(req, res);
    } else if (vnpOrderId?.startsWith("REM_")) {
      // Appointment remaining payment 90%
      console.log("→ Routing to Appointment Remaining Payment Return");
      return await appointmentRemaining90Return(req, res);
    } else if (
      vnpOrderId &&
      vnpOrderId.includes("_") &&
      !vnpOrderId.startsWith("FULL_") &&
      !vnpOrderId.startsWith("REM_")
    ) {
      // Có thể là appointment deposit (format: appointmentIdShort_timestamp)
      // Hoặc wallet payment (format: userId_timestamp)
      // Kiểm tra PaymentTransaction để phân biệt
      const PaymentTransaction = (await import("../models/PaymentTransaction"))
        .default;
      const transaction = await PaymentTransaction.findOne({
        orderId: vnpOrderId,
      });

      if (transaction && transaction.description?.includes("appointment")) {
        // Appointment deposit 10%
        console.log("→ Routing to Appointment Deposit Return");
        return await appointmentDeposit10Return(req, res);
      }
    }

    // Mặc định: Wallet payment
    console.log("→ Routing to Wallet Payment Return");
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
    console.error("❌ VNPay return error:", error);
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

// Handler cho Appointment Deposit 10% Callback
export const appointmentDeposit10Callback = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("=== Appointment Deposit 10% Callback Called ===");
    console.log("Query params:", req.query);

    const result = await handleAppointmentDeposit10Callback(req.query);

    if (result.success) {
      res.status(200).json({
        RspCode: "00",
        Message: "Success",
      });
    } else {
      res.status(200).json({
        RspCode: result.responseCode || "99",
        Message: result.message || "Failed",
      });
    }
  } catch (error: any) {
    console.error("❌ Appointment Deposit 10% callback error:", error);
    res.status(200).json({
      RspCode: "99",
      Message: "Internal Error",
    });
  }
};

// Handler cho Appointment Full Payment 100% Callback
export const appointmentFullPaymentCallback = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("=== Appointment Full Payment 100% Callback Called ===");
    console.log("Query params:", req.query);

    const result = await handleAppointmentFullPaymentCallback(req.query);

    if (result.success) {
      res.status(200).json({
        RspCode: "00",
        Message: "Success",
      });
    } else {
      res.status(200).json({
        RspCode: result.responseCode || "99",
        Message: result.message || "Failed",
      });
    }
  } catch (error: any) {
    console.error("❌ Appointment Full Payment 100% callback error:", error);
    res.status(200).json({
      RspCode: "99",
      Message: "Internal Error",
    });
  }
};

// Handler cho Appointment Deposit 10% Return URL
export const appointmentDeposit10Return = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("=== Appointment Deposit 10% Return URL Called ===");
    console.log("Query params:", req.query);

    const result = await handleAppointmentDeposit10Return(req.query);

    if (result.success) {
      // Redirect về frontend success page
      res.redirect(
        `http://localhost:5173/appointments?success=true&type=deposit&amount=${result.amount}&appointmentId=${result.appointmentId}`
      );
    } else {
      let message = "Thanh toán đặt cọc thất bại";
      res.redirect(
        `http://localhost:5173/appointments?success=false&message=${encodeURIComponent(
          message
        )}&code=${result.responseCode}`
      );
    }
  } catch (error: any) {
    console.error("❌ Appointment Deposit 10% return error:", error);
    res.redirect(
      `http://localhost:5173/appointments?success=false&message=${encodeURIComponent(
        "Có lỗi xảy ra: " + error.message
      )}`
    );
  }
};

// Handler cho Appointment Full Payment 100% Return URL
export const appointmentFullPaymentReturn = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("=== Appointment Full Payment 100% Return URL Called ===");
    console.log("Query params:", req.query);

    const result = await handleAppointmentFullPaymentReturn(req.query);

    if (result.success) {
      // Redirect về frontend success page
      res.redirect(
        `http://localhost:5173/appointments?success=true&type=full&amount=${result.amount}&appointmentId=${result.appointmentId}`
      );
    } else {
      let message = "Thanh toán toàn bộ thất bại";
      res.redirect(
        `http://localhost:5173/appointments?success=false&message=${encodeURIComponent(
          message
        )}&code=${result.responseCode}`
      );
    }
  } catch (error: any) {
    console.error("❌ Appointment Full Payment 100% return error:", error);
    res.redirect(
      `http://localhost:5173/appointments?success=false&message=${encodeURIComponent(
        "Có lỗi xảy ra: " + error.message
      )}`
    );
  }
};

// Handler cho Appointment Remaining 90% Callback
export const appointmentRemaining90Callback = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("=== Appointment Remaining 90% Callback Called ===");
    console.log("Query params:", req.query);

    const result = await handleAppointmentRemaining90Callback(req.query);

    if (result.success) {
      res.status(200).json({
        RspCode: "00",
        Message: "Success",
      });
    } else {
      res.status(200).json({
        RspCode: result.responseCode || "99",
        Message: result.message || "Failed",
      });
    }
  } catch (error: any) {
    console.error("❌ Appointment Remaining 90% callback error:", error);
    res.status(200).json({
      RspCode: "99",
      Message: "Internal Error",
    });
  }
};

// Handler cho Appointment Remaining 90% Return URL
export const appointmentRemaining90Return = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("=== Appointment Remaining 90% Return URL Called ===");
    console.log("Query params:", req.query);

    const result = await handleAppointmentRemaining90Return(req.query);

    if (result.success) {
      // Redirect về frontend success page
      res.redirect(
        `http://localhost:5173/appointments/${result.appointmentId}?success=true&type=remaining&amount=${result.amount}`
      );
    } else {
      let message = result.message || "Thanh toán còn lại thất bại";
      res.redirect(
        `http://localhost:5173/appointments/${
          result.appointmentId
        }?success=false&message=${encodeURIComponent(message)}&code=${
          result.responseCode
        }`
      );
    }
  } catch (error: any) {
    console.error("❌ Appointment Remaining 90% return error:", error);
    res.redirect(
      `http://localhost:5173/appointments?success=false&message=${encodeURIComponent(
        "Có lỗi xảy ra: " + error.message
      )}`
    );
  }
};
