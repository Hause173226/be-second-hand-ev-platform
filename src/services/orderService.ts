import Order from "../models/Order";
import Escrow from "../models/Escrow";
import mongoose from "mongoose";

export const orderService = {
  /**
   * Seller cập nhật tình trạng bàn giao
   */
  updateDeliveryStatus: async (
    orderId: string,
    sellerId: string,
    deliveryStatus: "IN_DELIVERY" | "INSPECTING" | "DELIVERED",
    notes?: string
  ) => {
    // Validate ObjectId
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(sellerId)
    ) {
      throw new Error("Invalid order ID or seller ID");
    }

    // Tìm order
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    // Kiểm tra quyền: chỉ seller mới được cập nhật
    if (order.seller_id.toString() !== sellerId) {
      throw new Error("Only seller can update delivery status");
    }

    // Kiểm tra trạng thái order phải là IN_TRANSACTION
    if (order.status !== "IN_TRANSACTION") {
      throw new Error(
        "Order must be in IN_TRANSACTION status to update delivery"
      );
    }

    // Cập nhật delivery_status
    order.delivery_status = deliveryStatus;

    // Nếu có notes, lưu vào meeting.notes
    if (notes) {
      order.meeting = {
        ...order.meeting,
        notes: notes,
      };
    }

    // Lưu
    await order.save();

    // Trả về kết quả
    return {
      message: "Delivery status updated successfully",
      order: {
        _id: order._id,
        status: order.status,
        delivery_status: order.delivery_status,
        meeting: order.meeting,
        updated_at: order.updated_at,
      },
    };
  },

  /**
   * Buyer xác nhận đã nhận hàng và đúng mô tả
   */
  buyerConfirmDelivery: async (
    orderId: string,
    buyerId: string,
    isCorrect: boolean,
    rating?: number,
    comment?: string,
    issues?: string[]
  ) => {
    // Validate ObjectId
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(buyerId)
    ) {
      throw new Error("Invalid order ID or buyer ID");
    }

    // Validate rating
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Tìm order
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    // Kiểm tra quyền: chỉ buyer mới được xác nhận
    if (order.buyer_id.toString() !== buyerId) {
      throw new Error("Only buyer can confirm delivery");
    }

    // Kiểm tra trạng thái order phải là IN_TRANSACTION
    if (order.status !== "IN_TRANSACTION") {
      throw new Error(
        "Order must be in IN_TRANSACTION status to confirm delivery"
      );
    }

    // Kiểm tra delivery_status phải là DELIVERED
    if (order.delivery_status !== "DELIVERED") {
      throw new Error("Seller must mark as DELIVERED before buyer can confirm");
    }

    // Kiểm tra đã confirm chưa
    if (order.buyer_confirmation?.confirmed) {
      throw new Error("Order already confirmed by buyer");
    }

    // Bắt đầu transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Cập nhật buyer confirmation
      order.buyer_confirmation = {
        confirmed: true,
        confirmed_at: new Date(),
        is_correct: isCorrect,
        rating: rating,
        comment: comment,
        issues: issues || [],
      };

      let escrowReleased = false;
      let amountReleased = 0;

      if (isCorrect) {
        // Nếu đúng mô tả -> Giải phóng tiền từ Escrow
        order.status = "COMPLETED";

        // Tìm và cập nhật Escrow
        if (order.escrow_id) {
          const escrow = await Escrow.findById(order.escrow_id).session(
            session
          );

          if (escrow && escrow.status === "IN_TRANSACTION") {
            // Tính toán số tiền thực tế cho seller (trừ phí)
            const platformFee = escrow.fees?.platform || 0;
            const escrowFee = escrow.fees?.escrow || 0;
            const totalFees = platformFee + escrowFee;
            const sellerAmount = escrow.amount_hold - totalFees;

            // Cập nhật escrow
            escrow.status = "COMPLETED";
            escrow.payout = {
              seller_account_id: order.seller_id.toString(),
              payout_status: "PAID",
              payout_at: new Date(),
              amount: sellerAmount,
            };

            await escrow.save({ session });

            escrowReleased = true;
            amountReleased = sellerAmount;
          }
        }
      } else {
        // Nếu không đúng mô tả -> Mở tranh chấp
        order.status = "IN_DISPUTE";

        // Giữ Escrow ở trạng thái IN_DISPUTE
        if (order.escrow_id) {
          const escrow = await Escrow.findById(order.escrow_id).session(
            session
          );

          if (escrow) {
            escrow.status = "IN_DISPUTE";
            await escrow.save({ session });
          }
        }
      }

      // Lưu order
      await order.save({ session });

      // Commit transaction
      await session.commitTransaction();

      return {
        message: isCorrect
          ? "Xác nhận thành công. Tiền đã được giải phóng cho người bán."
          : "Đã ghi nhận vấn đề. Đơn hàng chuyển sang trạng thái tranh chấp.",
        order: {
          _id: order._id,
          status: order.status,
          delivery_status: order.delivery_status,
          buyer_confirmation: order.buyer_confirmation,
          updated_at: order.updated_at,
        },
        escrow_released: escrowReleased,
        amount_released: amountReleased,
      };
    } catch (error) {
      // Rollback transaction nếu có lỗi
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  /**
   * Lấy thông tin order (helper)
   */
  getOrderById: async (orderId: string) => {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("Invalid order ID");
    }

    const order = await Order.findById(orderId)
      .populate("listing_id", "title brand model")
      .populate("buyer_id", "full_name email phone")
      .populate("seller_id", "full_name email phone");

    if (!order) {
      throw new Error("Order not found");
    }

    return order;
  },
};
