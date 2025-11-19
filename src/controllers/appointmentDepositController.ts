import { Request, Response } from "express";
import {
  createDeposit10PaymentUrl,
  createFullPaymentUrl,
  createRemaining90PaymentUrl,
} from "../services/appointmentDepositPaymentService";
import Appointment from "../models/Appointment";
import mongoose from "mongoose";

/**
 * @route POST /api/staff/appointments/:appointmentId/deposit
 * @desc Staff tạo đặt cọc 10%
 * @access Private (Staff only)
 */
export const createDeposit = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      res.status(400).json({ error: "Invalid appointment ID" });
      return;
    }

    // Kiểm tra quyền staff
    const userRole = (req as any).user?.role;
    if (userRole !== "staff" && userRole !== "admin") {
      res
        .status(403)
        .json({ error: "Chỉ staff/admin mới có quyền tạo đặt cọc" });
      return;
    }

    // Tìm Appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ error: "Không tìm thấy appointment" });
      return;
    }

    // Kiểm tra appointment phải ở trạng thái CONFIRMED
    if (appointment.status !== "CONFIRMED") {
      res.status(400).json({
        error: "Appointment phải được xác nhận (CONFIRMED) trước khi tạo đặt cọc",
        currentStatus: appointment.status,
      });
      return;
    }

    // Tạo payment URL
    const {
      vnpUrl,
      orderId: vnpOrderId,
      amount,
    } = await createDeposit10PaymentUrl(appointmentId, req);

    // Cập nhật timeline.depositRequestAt
    if (!appointment.timeline) {
      appointment.timeline = {};
    }
    appointment.timeline.depositRequestAt = new Date();
    await appointment.save();

    res.status(200).json({
      message: "Tạo đặt cọc thành công",
      paymentUrl: vnpUrl,
      orderId: vnpOrderId,
      amount: amount,
      qrCode: vnpUrl, // QR code là URL thanh toán
    });
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

/**
 * @route POST /api/staff/appointments/:appointmentId/full-payment
 * @desc Staff tạo thanh toán toàn bộ 100%
 * @access Private (Staff only)
 */
export const createFullPayment = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      res.status(400).json({ error: "Invalid appointment ID" });
      return;
    }

    // Kiểm tra quyền staff
    const userRole = (req as any).user?.role;
    if (userRole !== "staff" && userRole !== "admin") {
      res
        .status(403)
        .json({ error: "Chỉ staff/admin mới có quyền tạo thanh toán toàn bộ" });
      return;
    }

    // Tìm Appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ error: "Không tìm thấy appointment" });
      return;
    }

    // Kiểm tra appointment phải ở trạng thái CONFIRMED
    if (appointment.status !== "CONFIRMED") {
      res.status(400).json({
        error: "Appointment phải được xác nhận (CONFIRMED) trước khi tạo thanh toán toàn bộ",
        currentStatus: appointment.status,
      });
      return;
    }

    // Tạo payment URL
    const {
      vnpUrl,
      orderId: vnpOrderId,
      amount,
    } = await createFullPaymentUrl(appointmentId, req);

    // Cập nhật timeline.fullPaymentRequestAt
    if (!appointment.timeline) {
      appointment.timeline = {};
    }
    appointment.timeline.fullPaymentRequestAt = new Date();
    await appointment.save();

    res.status(200).json({
      message: "Tạo thanh toán toàn bộ thành công",
      paymentUrl: vnpUrl,
      orderId: vnpOrderId,
      amount: amount,
      qrCode: vnpUrl, // QR code là URL thanh toán
    });
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

/**
 * @route POST /api/appointments/:appointmentId/remaining-payment
 * @desc User tự tạo thanh toán còn lại 90%
 * @access Private (User - buyer only)
 */
export const createRemainingPayment = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      res.status(400).json({ error: "Invalid appointment ID" });
      return;
    }

    // Lấy userId từ token
    const userId = (req as any).user?.userId || (req as any).user?._id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Tìm Appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ error: "Không tìm thấy appointment" });
      return;
    }

    // Kiểm tra quyền: chỉ buyer mới được tạo thanh toán còn lại
    if (appointment.buyerId.toString() !== userId.toString()) {
      res.status(403).json({ error: "Chỉ buyer mới có quyền thanh toán còn lại" });
      return;
    }

    // Kiểm tra appointment phải ở trạng thái chờ thanh toán còn lại
    if (appointment.status !== "AWAITING_REMAINING_PAYMENT") {
      res.status(400).json({
        error: "Appointment chưa sẵn sàng để thanh toán phần còn lại",
        currentStatus: appointment.status,
      });
      return;
    }

    // Kiểm tra đã đặt cọc 10% chưa
    if (!appointment.timeline?.depositPaidAt) {
      res.status(400).json({
        error: "Phải đặt cọc 10% trước khi thanh toán 90% còn lại",
      });
      return;
    }

    // Kiểm tra chưa thanh toán 90% hoặc 100%
    if (appointment.timeline?.remainingPaidAt || appointment.timeline?.fullPaymentPaidAt) {
      res.status(400).json({
        error: "Đã thanh toán đủ số tiền còn lại",
      });
      return;
    }

    // Tạo payment URL
    const {
      vnpUrl,
      orderId: vnpOrderId,
      amount,
    } = await createRemaining90PaymentUrl(appointmentId, req);

    // Cập nhật timeline.remainingPaymentRequestAt
    if (!appointment.timeline) {
      appointment.timeline = {};
    }
    appointment.timeline.remainingPaymentRequestAt = new Date();
    await appointment.save();

    res.status(200).json({
      message: "Tạo thanh toán còn lại thành công",
      paymentUrl: vnpUrl,
      orderId: vnpOrderId,
      amount: amount,
      qrCode: vnpUrl, // QR code là URL thanh toán
    });
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

/**
 * @route GET /api/appointments/:appointmentId/timeline
 * @desc User xem timeline giao dịch
 * @access Private
 */
export const getAppointmentTimeline = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      res.status(400).json({ error: "Invalid appointment ID" });
      return;
    }

    // Lấy userId từ token
    const userId = (req as any).user?.userId || (req as any).user?._id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Tìm Appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ error: "Không tìm thấy appointment" });
      return;
    }

    // Kiểm tra quyền: chỉ buyer, seller hoặc staff mới được xem
    const isBuyer = appointment.buyerId.toString() === userId.toString();
    const isSeller = appointment.sellerId.toString() === userId.toString();
    const isStaff =
      (req as any).user?.role === "staff" ||
      (req as any).user?.role === "admin";

    if (!isBuyer && !isSeller && !isStaff) {
      res.status(403).json({ error: "Không có quyền xem timeline" });
      return;
    }

    // Trả về timeline
    res.status(200).json({
      depositRequestAt: appointment.timeline?.depositRequestAt || null,
      depositPaidAt: appointment.timeline?.depositPaidAt || null,
      remainingPaymentRequestAt:
        appointment.timeline?.remainingPaymentRequestAt || null,
      remainingPaidAt: appointment.timeline?.remainingPaidAt || null,
      fullPaymentRequestAt: appointment.timeline?.fullPaymentRequestAt || null,
      fullPaymentPaidAt: appointment.timeline?.fullPaymentPaidAt || null,
      completedAt: appointment.timeline?.completedAt || null,
    });
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

