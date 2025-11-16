import { Request, Response } from "express";
import DepositRequest from "../models/DepositRequest";
import Listing from "../models/Listing";
import { User } from "../models/User";
import walletService from "../services/walletService";
import depositNotificationService from "../services/depositNotificationService";
import qrCodeService from "../services/qrCodeService";

// Tạo yêu cầu đặt cọc
export const createDepositRequest = async (req: Request, res: Response) => {
  try {
    const { listingId, depositAmount } = req.body;
    const buyerId = req.user?.id;

    // Kiểm tra listing tồn tại
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin đăng",
      });
    }

    // Kiểm tra không được đặt cọc chính xe của mình
    if (listing.sellerId.toString() === buyerId) {
      return res.status(400).json({
        success: false,
        message: "Không thể đặt cọc xe của chính mình",
      });
    }

    // Kiểm tra xe còn bán không (phải là Published)
    if (listing.status !== "Published") {
      if (listing.status === "InTransaction") {
        return res.status(400).json({
          success: false,
          message: "Xe đang trong giao dịch, không thể đặt cọc",
        });
      }
      if (listing.status === "Sold") {
        return res.status(400).json({
          success: false,
          message: "Xe đã bán",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Xe không còn bán",
      });
    }

    // Kiểm tra xe có đang được đặt cọc bởi bất kỳ ai không
    const activeDepositRequest = await DepositRequest.findOne({
      listingId,
      status: {
        $in: ["PENDING_SELLER_CONFIRMATION", "SELLER_CONFIRMED", "IN_ESCROW"],
      },
    });

    // Nếu có người khác đang đặt cọc xe này → không cho phép
    if (
      activeDepositRequest &&
      activeDepositRequest.buyerId.toString() !== buyerId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Xe đang được đặt cọc bởi người mua khác, vui lòng thử lại sau",
      });
    }

    // Kiểm tra buyer đã đặt cọc xe này chưa
    const existingRequest = await DepositRequest.findOne({
      listingId,
      buyerId,
      status: {
        $in: ["PENDING_SELLER_CONFIRMATION", "SELLER_CONFIRMED", "IN_ESCROW"],
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đặt cọc xe này rồi",
      });
    }

    // Kiểm tra số dư ví người mua
    const buyerWallet = await walletService.getWallet(buyerId!);

    const listingTitle =
      listing.make != null && listing.model != null && listing.year != null
        ? `${String(listing.make)} ${String(listing.model)} ${String(
            listing.year
          )}`
        : "Xe";

    if (buyerWallet.balance < depositAmount) {
      // Không đủ tiền -> Tạo URL nạp tiền vào ví người dùng (không có QR code)
      const missingAmount = depositAmount - buyerWallet.balance; // Số tiền còn thiếu

      // Tạo URL nạp tiền vào ví (dùng walletService.createDepositUrl)
      const vnpayUrl = await walletService.createDepositUrl(
        buyerId!.toString(),
        missingAmount,
        `Nạp tiền đặt cọc mua xe ${listingTitle}`,
        req
      );

      return res.json({
        success: false,
        message: "Số dư không đủ để đặt cọc",
        vnpayUrl: vnpayUrl, // Chỉ trả về URL, không có QR code
        requiredAmount: depositAmount, // Tổng tiền đặt cọc cần
        currentBalance: buyerWallet.balance, // Số dư hiện tại
        missingAmount: missingAmount, // Số tiền còn thiếu (cần nạp số này)
      });
    }

    // Đủ tiền -> Tự động trừ tiền từ ví và chuyển vào escrow (không cần QR code)
    const depositRequest = new DepositRequest({
      listingId,
      buyerId,
      sellerId: listing.sellerId,
      depositAmount,
      status: "PENDING_PAYMENT", // Tạm thời, sẽ được cập nhật sau khi chuyển vào escrow
    });
    await depositRequest.save();

    // Trừ tiền từ ví người dùng (freeze)
    await walletService.freezeAmount(
      buyerId!.toString(),
      depositAmount,
      `Đặt cọc mua xe ${listingTitle}`
    );

    // Chuyển tiền vào escrow (sẽ tự động set status = "IN_ESCROW")
    await walletService.transferToEscrow(depositRequest._id?.toString() || "");

    // Cập nhật trạng thái listing
    listing.status = "InTransaction";
    await listing.save();

    // Lấy lại depositRequest sau khi transferToEscrow để có status mới nhất
    const updatedDepositRequest = await DepositRequest.findById(
      depositRequest._id
    );

    return res.json({
      success: true,
      message: "Chúc mừng bạn vừa đặt cọc sản phẩm thành công",
      depositRequestId: depositRequest._id?.toString() || "",
      depositAmount: depositAmount,
      status: updatedDepositRequest?.status || "IN_ESCROW",
      action: "DEPOSIT_COMPLETED", // Đánh dấu đã hoàn thành đặt cọc
      // Không cần QR code vì đã trừ tiền tự động
      qrCode: null,
      paymentUrl: null,
      orderId: null,
    });
  } catch (error) {
    console.error("Error creating deposit request:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Người bán xác nhận hoặc từ chối cọc
export const sellerConfirmDeposit = async (req: Request, res: Response) => {
  try {
    const { depositRequestId } = req.params; // Lấy từ URL path parameter
    const { action } = req.body; // 'CONFIRM' hoặc 'REJECT'
    const sellerId = req.user?.id;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const depositRequest = await DepositRequest.findById(depositRequestId);

    if (!depositRequest) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đặt cọc",
      });
    }

    // Kiểm tra quyền sở hữu
    if (depositRequest.sellerId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xác nhận yêu cầu này",
      });
    }

    // Kiểm tra trạng thái
    if (depositRequest.status !== "PENDING_SELLER_CONFIRMATION") {
      return res.status(400).json({
        success: false,
        message: "Yêu cầu đặt cọc đã được xử lý",
      });
    }

    if (action === "CONFIRM") {
      // Xác nhận cọc -> Chuyển tiền vào Escrow và tạo appointment
      const result = await walletService.transferToEscrow(depositRequestId);

      // Cập nhật status listing thành InTransaction khi seller confirm deposit
      const listing = await Listing.findById(depositRequest.listingId);
      if (listing && listing.status === "Published") {
        listing.status = "InTransaction";
        await listing.save();
      }

      // Gửi thông báo cho người mua
      try {
        const seller = await User.findById(sellerId);
        if (seller && listing) {
          await depositNotificationService.sendDepositConfirmationNotification(
            depositRequest.buyerId,
            depositRequest,
            seller,
            "accept",
            listing // Thêm thông tin listing
          );
        }
      } catch (notificationError) {
        console.error(
          "Error sending deposit confirmation notification:",
          notificationError
        );
      }

      res.json({
        success: true,
        message: "Xác nhận cọc thành công, tiền đã chuyển vào Escrow",
        escrow: {
          id: result.escrow._id,
          amount: result.escrow.amount,
          status: result.escrow.status,
        },
      });
    } else if (action === "REJECT") {
      // ✅ KHÔNG xóa notification của seller ở đây - để FE tự xóa sau khi reject thành công
      // (Nếu BE xóa, FE sẽ bị lỗi "Notification not found" khi cố gắng xóa lại)

      // Từ chối cọc -> Hoàn tiền từ frozen về ví người mua
      await walletService.unfreezeAmount(
        depositRequest.buyerId,
        depositRequest.depositAmount,
        "Seller từ chối đặt cọc"
      );

      // Cập nhật trạng thái deposit request
      depositRequest.status = "SELLER_CANCELLED";
      await depositRequest.save();

      // Gửi thông báo cho người mua
      try {
        const seller = await User.findById(sellerId);
        const listing = await Listing.findById(depositRequest.listingId);
        if (seller) {
          await depositNotificationService.sendDepositConfirmationNotification(
            depositRequest.buyerId,
            depositRequest,
            seller,
            "reject",
            listing // Thêm thông tin listing
          );
        }
      } catch (notificationError) {
        console.error(
          "Error sending deposit rejection notification:",
          notificationError
        );
      }

      res.json({
        success: true,
        message: "Đã từ chối cọc, tiền đã hoàn về ví người mua",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Hành động không hợp lệ",
      });
    }
  } catch (error) {
    console.error("Error confirming deposit:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Lấy danh sách yêu cầu đặt cọc của người mua
export const getBuyerDepositRequests = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user?.id;
    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }
    const { status, page = 1, limit = 10 } = req.query;

    const filter: any = { buyerId };
    if (status) {
      filter.status = status;
    }

    const depositRequests = await DepositRequest.find(filter)
      .populate("listingId", "make model year priceListed photos")
      .populate("sellerId", "name email phone")
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await DepositRequest.countDocuments(filter);

    res.json({
      success: true,
      data: depositRequests,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
      },
    });
  } catch (error) {
    console.error("Error getting buyer deposit requests:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Lấy danh sách yêu cầu đặt cọc của người bán
export const getSellerDepositRequests = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }
    const { status, page = 1, limit = 10 } = req.query;

    const filter: any = { sellerId };
    if (status) {
      filter.status = status;
    }

    const depositRequests = await DepositRequest.find(filter)
      .populate("listingId", "make model year priceListed photos")
      .populate("buyerId", "name email phone")
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await DepositRequest.countDocuments(filter);

    res.json({
      success: true,
      data: depositRequests,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
      },
    });
  } catch (error) {
    console.error("Error getting seller deposit requests:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Hủy yêu cầu đặt cọc (chỉ người mua)
export const cancelDepositRequest = async (req: Request, res: Response) => {
  try {
    const { depositRequestId } = req.params;
    const buyerId = req.user?.id;
    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đặt cọc",
      });
    }

    // Kiểm tra quyền sở hữu
    if (depositRequest.buyerId !== buyerId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy yêu cầu này",
      });
    }

    // Kiểm tra trạng thái
    if (depositRequest.status !== "PENDING_SELLER_CONFIRMATION") {
      return res.status(400).json({
        success: false,
        message: "Không thể hủy yêu cầu đã được xử lý",
      });
    }

    // Hoàn tiền về ví người mua
    await walletService.unfreezeAmount(
      buyerId,
      depositRequest.depositAmount,
      "Hủy đặt cọc"
    );

    // Cập nhật trạng thái
    depositRequest.status = "CANCELLED";
    await depositRequest.save();

    res.json({
      success: true,
      message: "Hủy đặt cọc thành công, tiền đã hoàn về ví",
    });
  } catch (error) {
    console.error("Error cancelling deposit request:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Hủy giao dịch khi tiền đã vào escrow (Buyer muốn hủy)
export const cancelTransactionInEscrow = async (
  req: Request,
  res: Response
) => {
  try {
    const { depositRequestId } = req.params;
    const buyerId = req.user?.id;
    const { reason } = req.body;

    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đặt cọc",
      });
    }

    // Kiểm tra quyền sở hữu
    if (depositRequest.buyerId !== buyerId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy giao dịch này",
      });
    }

    // Kiểm tra trạng thái (phải là IN_ESCROW)
    if (depositRequest.status !== "IN_ESCROW") {
      return res.status(400).json({
        success: false,
        message:
          "Chỉ có thể hủy giao dịch khi tiền đã vào escrow. Trạng thái hiện tại: " +
          depositRequest.status,
      });
    }

    // Hoàn tiền từ escrow về ví buyer
    await walletService.refundFromEscrow(depositRequestId);

    // Cập nhật trạng thái listing về Published để có thể bán lại
    const listing = await Listing.findById(depositRequest.listingId);
    if (listing && listing.status === "InTransaction") {
      listing.status = "Published";
      await listing.save();
    }

    // Cập nhật trạng thái
    depositRequest.status = "CANCELLED";
    await depositRequest.save();

    // Gửi notification cho seller
    try {
      const buyer = await User.findById(buyerId);

      if (buyer && listing) {
        // TODO: Thêm notification service cho trường hợp này
        console.log(
          `Buyer ${
            buyer.fullName
          } đã hủy giao dịch ${depositRequestId}. Lý do: ${
            reason || "Không nêu lý do"
          }`
        );
      }
    } catch (notificationError) {
      console.error("Error sending notification:", notificationError);
    }

    res.json({
      success: true,
      message: "Đã hủy giao dịch thành công, tiền đã hoàn về ví của bạn",
      depositRequest: {
        id: depositRequest._id,
        status: depositRequest.status,
      },
    });
  } catch (error) {
    console.error("Error cancelling transaction in escrow:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Tạo QR code thanh toán số tiền còn lại (sau khi đã đặt cọc)
export const generateRemainingAmountQrCode = async (
  req: Request,
  res: Response
) => {
  try {
    const { listingId, depositRequestId } = req.body;
    const buyerId = req.user?.id;

    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    // Kiểm tra listing tồn tại
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin đăng",
      });
    }

    // Kiểm tra deposit request tồn tại và thuộc về buyer
    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đặt cọc",
      });
    }

    if (depositRequest.buyerId.toString() !== buyerId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập yêu cầu này",
      });
    }

    // Tính số tiền còn lại = giá xe - tiền đặt cọc
    const listingPrice = listing.priceListed;
    const depositAmount = depositRequest.depositAmount;
    const remainingAmount = listingPrice - depositAmount;

    if (remainingAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tiền còn lại không hợp lệ",
      });
    }

    // Lấy thông tin user để hiển thị tên trên VNPay
    const buyer = await User.findById(buyerId);
    const buyerName = buyer?.fullName || buyer?.email || "";

    // Tạo QR code thanh toán số tiền còn lại
    const listingTitle =
      listing.make != null && listing.model != null && listing.year != null
        ? `${String(listing.make)} ${String(listing.model)} ${String(
            listing.year
          )}`
        : "Xe";
    const qrCodeResult = await qrCodeService.generateRemainingAmountQrCode(
      remainingAmount,
      listingTitle,
      buyerId.toString(),
      req,
      buyerName
    );

    res.json({
      success: true,
      message: "Tạo QR code thanh toán số tiền còn lại thành công",
      qrCode: qrCodeResult.qrCodeDataUrl,
      paymentUrl: qrCodeResult.paymentUrl,
      orderId: qrCodeResult.orderId,
      remainingAmount: remainingAmount,
      depositAmount: depositAmount,
      totalAmount: listingPrice,
    });
  } catch (error) {
    console.error("Error generating remaining amount QR code:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Tạo QR code thanh toán full (mua full không đặt cọc)
export const generateFullPaymentQrCode = async (
  req: Request,
  res: Response
) => {
  try {
    const { listingId } = req.body;
    const buyerId = req.user?.id;

    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    // Kiểm tra listing tồn tại
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin đăng",
      });
    }

    // Kiểm tra không được mua chính xe của mình
    if (listing.sellerId.toString() === buyerId) {
      return res.status(400).json({
        success: false,
        message: "Không thể mua xe của chính mình",
      });
    }

    // Kiểm tra xe còn bán không
    if (listing.status !== "Published") {
      if (listing.status === "InTransaction") {
        return res.status(400).json({
          success: false,
          message: "Xe đang trong giao dịch, không thể mua",
        });
      }
      if (listing.status === "Sold") {
        return res.status(400).json({
          success: false,
          message: "Xe đã bán",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Xe không còn bán",
      });
    }

    // Tính số tiền full = giá xe
    const fullAmount = listing.priceListed;

    if (fullAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Giá xe không hợp lệ",
      });
    }

    // Lấy thông tin user để hiển thị tên trên VNPay
    const buyer = await User.findById(buyerId);
    const buyerName = buyer?.fullName || buyer?.email || "";

    // Tạo QR code thanh toán full
    const listingTitle =
      listing.make != null && listing.model != null && listing.year != null
        ? `${String(listing.make)} ${String(listing.model)} ${String(
            listing.year
          )}`
        : "Xe";
    const qrCodeResult = await qrCodeService.generateFullPaymentQrCode(
      fullAmount,
      listingTitle,
      buyerId.toString(),
      req,
      buyerName,
      listingId // Truyền listingId để lưu vào PaymentTransaction
    );

    res.json({
      success: true,
      message: "Tạo QR code thanh toán toàn bộ thành công",
      qrCode: qrCodeResult.qrCodeDataUrl,
      paymentUrl: qrCodeResult.paymentUrl,
      orderId: qrCodeResult.orderId,
      fullAmount: fullAmount,
    });
  } catch (error) {
    console.error("Error generating full payment QR code:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
