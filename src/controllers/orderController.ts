import { Request, Response } from "express";
import { orderService } from "../services/orderService";

/**
 * @route PUT /api/orders/:orderId/delivery-status
 * @desc Seller cập nhật tình trạng bàn giao
 * @access Private (Seller only)
 */
export const updateDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { delivery_status, notes } = req.body;

    // Validate input
    if (!delivery_status) {
      res.status(400).json({ error: "Delivery status is required" });
      return;
    }

    const validStatuses = ["IN_DELIVERY", "INSPECTING", "DELIVERED"];
    if (!validStatuses.includes(delivery_status)) {
      res.status(400).json({
        error: "Invalid delivery status",
        valid_statuses: validStatuses,
      });
      return;
    }

    // Lấy seller_id từ token (req.user được set bởi authenticate middleware)
    const sellerId = (req as any).user?.userId || (req as any).user?._id;

    if (!sellerId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Gọi service
    const result = await orderService.updateDeliveryStatus(
      orderId,
      sellerId,
      delivery_status,
      notes
    );

    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Order not found") {
        res.status(404).json({ error: "Không tìm thấy đơn hàng" });
      } else if (err.message === "Only seller can update delivery status") {
        res.status(403).json({ error: "Chỉ người bán mới có thể cập nhật" });
      } else if (
        err.message ===
        "Order must be in IN_TRANSACTION status to update delivery"
      ) {
        res.status(400).json({
          error: "Đơn hàng phải ở trạng thái IN_TRANSACTION",
        });
      } else {
        res.status(400).json({ error: err.message });
      }
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

/**
 * @route POST /api/orders/:orderId/confirm-delivery
 * @desc Buyer xác nhận đã nhận hàng và đúng mô tả
 * @access Private (Buyer only)
 */
export const confirmDelivery = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { is_correct, rating, comment, issues } = req.body;

    // Validate input
    if (is_correct === undefined || is_correct === null) {
      res.status(400).json({
        error: "is_correct is required (true/false)",
      });
      return;
    }

    // Validate rating nếu có
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      res.status(400).json({
        error: "Rating must be between 1 and 5",
      });
      return;
    }

    // Nếu is_correct = false, yêu cầu phải có issues
    if (!is_correct && (!issues || issues.length === 0)) {
      res.status(400).json({
        error: "Issues are required when marking as incorrect",
      });
      return;
    }

    // Lấy buyer_id từ token
    const buyerId = (req as any).user?.userId || (req as any).user?._id;

    if (!buyerId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Gọi service
    const result = await orderService.buyerConfirmDelivery(
      orderId,
      buyerId,
      is_correct,
      rating,
      comment,
      issues
    );

    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Order not found") {
        res.status(404).json({ error: "Không tìm thấy đơn hàng" });
      } else if (err.message === "Only buyer can confirm delivery") {
        res.status(403).json({ error: "Chỉ người mua mới có thể xác nhận" });
      } else if (
        err.message ===
        "Order must be in IN_TRANSACTION status to confirm delivery"
      ) {
        res.status(400).json({
          error: "Đơn hàng phải ở trạng thái IN_TRANSACTION",
        });
      } else if (
        err.message === "Seller must mark as DELIVERED before buyer can confirm"
      ) {
        res.status(400).json({
          error: "Người bán phải đánh dấu đã bàn giao trước",
        });
      } else if (err.message === "Order already confirmed by buyer") {
        res.status(400).json({
          error: "Đơn hàng đã được xác nhận trước đó",
        });
      } else {
        res.status(400).json({ error: err.message });
      }
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

/**
 * @route GET /api/orders/:orderId
 * @desc Lấy thông tin order
 * @access Private
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const order = await orderService.getOrderById(orderId);

    res.status(200).json(order);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Order not found") {
        res.status(404).json({ error: "Không tìm thấy đơn hàng" });
      } else {
        res.status(400).json({ error: err.message });
      }
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};
