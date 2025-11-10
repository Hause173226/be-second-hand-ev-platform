import { Request, Response } from "express";
import Appointment from "../models/Appointment";
import DepositRequest from "../models/DepositRequest";
import Listing from "../models/Listing";
import Contract from "../models/Contract";
import { User } from "../models/User";
import walletService from "../services/walletService";
import { uploadFromBuffer } from "../services/cloudinaryService";
import depositNotificationService from "../services/depositNotificationService";
import emailService from "../services/emailService";

// Lấy thông tin hợp đồng (người mua/bán và xe)
export const getContractInfo = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id;

    // Kiểm tra appointment tồn tại
    const appointment = await Appointment.findById(appointmentId)
      .populate("depositRequestId")
      .populate({
        path: "auctionId",
        populate: {
          path: "listingId"
        }
      })
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    // Kiểm tra quyền xem (chỉ người mua, người bán hoặc nhân viên)
    const isBuyer = (appointment.buyerId as any)._id.toString() === userId;
    const isSeller = (appointment.sellerId as any)._id.toString() === userId;
    const isStaff = req.user?.role === "staff" || req.user?.role === "admin";

    if (!isBuyer && !isSeller && !isStaff) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem thông tin hợp đồng này",
      });
    }

    // Xác định loại appointment và lấy listing
    let listing;
    let depositAmount = 0;
    let finalPrice = 0; // Giá xe thực tế
    
    if (appointment.appointmentType === 'AUCTION' && appointment.auctionId) {
      // Appointment từ đấu giá
      const auction = appointment.auctionId as any;
      if (!auction || !auction.listingId) {
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy thông tin auction hoặc listingId",
        });
      }
      listing = auction.listingId;
      depositAmount = 1000000; // Phí tham gia đấu giá cố định
      finalPrice = auction.winningBid?.price || auction.startingPrice; // Giá thắng đấu giá
    } else {
      // Appointment từ đặt cọc thông thường
      const depositRequest = appointment.depositRequestId as any;
      if (!depositRequest || !depositRequest.listingId) {
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy thông tin depositRequest hoặc listingId",
        });
      }
      listing = await Listing.findById(depositRequest.listingId);
      depositAmount = depositRequest.depositAmount;
      finalPrice = listing?.priceListed || 0; // Giá niêm yết
    }

    // Kiểm tra listing tồn tại
    if (!listing) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy thông tin xe",
      });
    }

    // Lấy thông tin chi tiết
    // Lấy thông tin chi tiết
    const buyerProfile = await User.findById((appointment.buyerId as any)._id);
    const sellerProfile = await User.findById((appointment.sellerId as any)._id);

    res.json({
      success: true,
      message: "Lấy thông tin hợp đồng thành công",
      contractInfo: {
        // Thông tin người mua
        buyer: {
          name: buyerProfile?.fullName || (appointment.buyerId as any).fullName,
          email: (appointment.buyerId as any).email,
          phone: (appointment.buyerId as any).phone,
          idNumber: buyerProfile?.citizenId || "",
          address: buyerProfile?.address?.fullAddress || "",
        },

        // Thông tin người bán
        seller: {
          name:
            sellerProfile?.fullName || (appointment.sellerId as any).fullName,
          email: (appointment.sellerId as any).email,
          phone: (appointment.sellerId as any).phone,
          idNumber: sellerProfile?.citizenId || "",
          address: sellerProfile?.address?.fullAddress || "",
        },

        // Thông tin xe
        vehicle: {
          title: (listing as any).title,
          brand: (listing as any).brand,
          model: (listing as any).model,
          type: (listing as any).type,
          color: (listing as any).color,
          year: (listing as any).year,
          price: (listing as any).price,
          engineNumber: (listing as any).engineNumber || "",
          chassisNumber: (listing as any).chassisNumber || "",
          seatCount: (listing as any).seatCount || "",
          licensePlate: (listing as any).licensePlate || "",
          registrationNumber: (listing as any).registrationNumber || "",
          registrationDate: (listing as any).registrationDate || null,
          registrationIssuedBy: (listing as any).registrationIssuedBy || "",
          registrationIssuedTo: (listing as any).registrationIssuedTo || "",
          registrationAddress: (listing as any).registrationAddress || "",
        },

        // Thông tin giao dịch
        transaction: {
          depositAmount: depositAmount,
          finalPrice: finalPrice,
          appointmentDate: appointment.scheduledDate,
          location: appointment.location,
          appointmentType: appointment.appointmentType,
        },
      },
    });
  } catch (error: any) {
    console.error("Error getting contract info:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error?.message || "Unknown error",
    });
  }
};

// Staff upload ảnh hợp đồng đã ký
export const uploadContractPhotos = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const staffId = req.user?.id;
    const { description } = req.body;

    // Kiểm tra quyền staff
    const isStaff = req.user?.role === "staff" || req.user?.role === "admin";
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền upload ảnh hợp đồng",
      });
    }

    // Kiểm tra appointment tồn tại và đã được xác nhận
    const appointment = await Appointment.findById(appointmentId)
      .populate("depositRequestId")
      .populate({
        path: "auctionId",
        populate: {
          path: "listingId"
        }
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    if (appointment.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: "Lịch hẹn chưa được xác nhận hoặc đã hoàn thành",
      });
    }

    // Xác định loại appointment và lấy listingId
    let listingId;
    let depositRequestId = null;
    
    if (appointment.appointmentType === 'AUCTION' && appointment.auctionId) {
      // Appointment từ đấu giá
      const auction = appointment.auctionId as any;
      if (!auction || !auction.listingId) {
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy thông tin auction hoặc listingId",
        });
      }
      listingId = auction.listingId._id || auction.listingId;
    } else {
      // Appointment từ đặt cọc thông thường
      const depositRequest = appointment.depositRequestId as any;
      if (!depositRequest || !depositRequest.listingId) {
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy depositRequest hoặc listingId cho lịch hẹn này",
        });
      }
      listingId = depositRequest.listingId;
      depositRequestId = depositRequest._id;
    }

    // Kiểm tra có file upload không
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất 1 ảnh hợp đồng",
      });
    }

    // Upload ảnh lên Cloudinary
    const uploadedPhotos = [];
    for (const file of files) {
      try {
        // Check file buffer
        if (!file.buffer || file.buffer.length === 0) {
          console.error("Empty file buffer:", file.originalname);
          continue;
        }

        console.log(
          `Uploading file: ${file.originalname}, size: ${file.buffer.length} bytes`
        );

        const uploadResult = await uploadFromBuffer(
          file.buffer,
          `contract-${appointmentId}-${Date.now()}`,
          {
            folder: "secondhand-ev/contracts/signed-contracts",
            resource_type: "image",
          }
        );

        uploadedPhotos.push({
          url: uploadResult.secureUrl,
          publicId: uploadResult.publicId,
          uploadedBy: staffId!,
          uploadedAt: new Date(),
          description: description || "Ảnh hợp đồng đã ký",
        });

        console.log(`Successfully uploaded: ${file.originalname}`);
      } catch (uploadError) {
        console.error("Error uploading photo:", uploadError);
        // Tiếp tục với các ảnh khác nếu có lỗi
      }
    }

    if (uploadedPhotos.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Không thể upload ảnh nào",
      });
    }

    // Tìm hoặc tạo Contract record
    let contract = await Contract.findOne({ appointmentId });

    // ✅ Xóa ảnh cũ trên Cloudinary nếu contract đã có ảnh (để replace)
    if (
      contract &&
      contract.contractPhotos &&
      (contract.contractPhotos as any[]).length > 0
    ) {
      try {
        const { deleteMany } = await import("../services/cloudinaryService");
        const oldPublicIds = (contract.contractPhotos as any[])
          .map((photo) => photo.publicId)
          .filter(Boolean);

        if (oldPublicIds.length > 0) {
          await deleteMany(oldPublicIds);
          console.log(
            `✅ Deleted ${oldPublicIds.length} old contract photos from Cloudinary`
          );
        }
      } catch (deleteError) {
        console.error(
          "Error deleting old photos from Cloudinary:",
          deleteError
        );
        // Tiếp tục dù có lỗi xóa (không block upload)
      }
    }

    if (!contract) {
      // Tạo contract mới với thông tin cơ bản
      const listing = await Listing.findById(listingId);
      const buyer = await User.findById(appointment.buyerId);
      const seller = await User.findById(appointment.sellerId);

      if (!listing || !buyer || !seller) {
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy thông tin giao dịch",
        });
      }

      // Lấy depositAmount tùy theo loại appointment
      let depositAmount = 0;
      if (appointment.appointmentType === 'AUCTION') {
        depositAmount = 1000000; // Phí tham gia đấu giá
      } else if (depositRequestId) {
        const depositReq = await DepositRequest.findById(depositRequestId);
        depositAmount = depositReq?.depositAmount || 0;
      }

      contract = new Contract({
        appointmentId,
        depositRequestId: depositRequestId,
        auctionId: appointment.appointmentType === 'AUCTION' ? appointment.auctionId : undefined,
        buyerId: appointment.buyerId,
        sellerId: appointment.sellerId,
        listingId: listingId,
        contractNumber: `CT-${Date.now()}`,
        contractDate: new Date(),

        // Thông tin người mua
        buyerName: buyer.fullName || buyer.email,
        buyerIdNumber: buyer.citizenId || "N/A",
        buyerIdIssuedDate: new Date(), // Default value
        buyerIdIssuedBy: "Cơ quan có thẩm quyền", // Default value
        buyerAddress: buyer.address?.fullAddress || "N/A",

        // Thông tin người bán
        sellerName: seller.fullName || seller.email,
        sellerIdNumber: seller.citizenId || "N/A",
        sellerIdIssuedDate: new Date(), // Default value
        sellerIdIssuedBy: "Cơ quan có thẩm quyền", // Default value
        sellerAddress: seller.address?.fullAddress || "N/A",

        // Thông tin xe
        vehicleBrand: listing.make || "N/A",
        vehicleModel: listing.model || "N/A",
        vehicleType: (listing as any).vehicleType || "N/A",
        vehicleColor: (listing as any).paintColor || "N/A",
        engineNumber: (listing as any).engineNumber || "N/A",
        chassisNumber: (listing as any).chassisNumber || "N/A",
        seatCount: 1, // Default value - xe máy thường 1-2 chỗ
        manufactureYear: listing.year || new Date().getFullYear(),
        licensePlate: (listing as any).licensePlate || "N/A",
        registrationNumber: "N/A", // Default value - không có trong model
        registrationIssuedDate: new Date(), // Default value
        registrationIssuedBy: "Cơ quan có thẩm quyền", // Default value
        registrationIssuedTo: "N/A", // Default value
        registrationAddress: "N/A", // Default value

        // Thông tin giao dịch
        purchasePrice: listing.priceListed || 0,
        depositAmount: depositAmount,
        paymentMethod: "Escrow",

        status: "SIGNED",
        signedAt: new Date(),

        // Thông tin staff
        staffId: staffId!,
        staffName: req.user?.name || req.user?.email,

        contractPhotos: uploadedPhotos, // ✅ Ảnh mới
      });
    } else {
      // ✅ Replace toàn bộ ảnh cũ bằng ảnh mới (không append)
      contract.contractPhotos = uploadedPhotos as any;
      contract.status = "SIGNED";
      contract.signedAt = new Date();
      contract.staffId = staffId!;
      contract.staffName = req.user?.name || req.user?.email;
    }

    await contract.save();

    res.json({
      success: true,
      message: `Đã upload ${uploadedPhotos.length} ảnh hợp đồng thành công`,
      data: {
        contractId: contract._id,
        uploadedPhotos: uploadedPhotos.length,
        contractStatus: contract.status,
        photos: uploadedPhotos.map((photo) => ({
          url: photo.url,
          description: photo.description,
          uploadedAt: photo.uploadedAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error uploading contract photos:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error?.message || "Unknown error",
    });
  }
};

// Staff xác nhận giao dịch hoàn thành
export const completeTransaction = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const staffId = req.user?.id;

    // Kiểm tra quyền staff
    const isStaff = req.user?.role === "staff" || req.user?.role === "admin";
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền xác nhận giao dịch",
      });
    }

    // Kiểm tra appointment tồn tại
    const appointment = await Appointment.findById(appointmentId)
      .populate("depositRequestId")
      .populate({
        path: "auctionId",
        populate: {
          path: "listingId"
        }
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    if (appointment.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: "Lịch hẹn chưa được xác nhận hoặc đã hoàn thành",
      });
    }

    // Kiểm tra contract đã có ảnh chưa
    const contract = await Contract.findOne({ appointmentId });
    if (
      !contract ||
      !contract.contractPhotos ||
      (contract.contractPhotos as any[]).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng upload ảnh hợp đồng trước khi xác nhận giao dịch",
      });
    }

    // Xác định loại appointment và xử lý tương ứng
    const isAuction = appointment.appointmentType === 'AUCTION' && appointment.auctionId;
    let listingId;

    if (isAuction) {
      // Appointment từ đấu giá - Không cần chuyển tiền từ escrow vì đã xử lý khi đấu giá
      const auction = appointment.auctionId as any;
      listingId = auction?.listingId?._id || auction?.listingId;
      
      // Với auction, tiền cọc đã bị khóa, không cần completeTransaction
      console.log('✅ Completing auction transaction - no escrow transfer needed');
    } else {
      // Appointment từ đặt cọc thông thường
      const depositRequest = appointment.depositRequestId as any;
      if (!depositRequest || !depositRequest._id) {
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy thông tin deposit request",
        });
      }
      
      listingId = depositRequest.listingId;
      
      // Chuyển tiền từ Escrow về hệ thống
      await walletService.completeTransaction(depositRequest._id);
    }

    // Cập nhật trạng thái listing thành Sold
    const listing = await Listing.findById(listingId);
    if (listing) {
      listing.status = "Sold";
      await listing.save();
      console.log(`✅ Updated listing ${listingId} status to Sold`);
    }

    // Cập nhật trạng thái contract
    contract.status = "COMPLETED";
    contract.completedAt = new Date();
    await contract.save();

    // Cập nhật trạng thái appointment
    appointment.status = "COMPLETED";
    appointment.completedAt = new Date();
    await appointment.save();

    // Gửi thông báo cho buyer và seller
    try {
      await depositNotificationService.sendTransactionCompleteNotification(
        appointment.buyerId.toString(),
        appointment.sellerId.toString(),
        contract
      );
    } catch (notificationError) {
      console.error(
        "Error sending transaction complete notification:",
        notificationError
      );
    }

    res.json({
      success: true,
      message: "Xác nhận giao dịch hoàn thành thành công",
      data: {
        contractId: contract._id,
        appointmentId: appointment._id,
        completedAt: contract.completedAt,
        contractPhotos: (contract.contractPhotos as any[]).length,
        transactionStatus: "COMPLETED",
      },
    });
  } catch (error: any) {
    console.error("Error completing transaction:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error?.message || "Unknown error",
    });
  }
};

// Lấy danh sách contract cho staff
export const getStaffContracts = async (req: Request, res: Response) => {
  try {
    const staffId = req.user?.id;

    // Kiểm tra quyền staff
    const isStaff = req.user?.role === "staff" || req.user?.role === "admin";
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền truy cập",
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const contracts = await Contract.find(filter)
      .populate("appointmentId", "scheduledDate status")
      .populate("buyerId", "name email phone")
      .populate("sellerId", "name email phone")
      .populate("listingId", "title brand model year price")
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Contract.countDocuments(filter);

    res.json({
      success: true,
      message: "Lấy danh sách hợp đồng thành công",
      data: contracts,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
      },
    });
  } catch (error: any) {
    console.error("Error getting staff contracts:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error?.message || "Unknown error",
    });
  }
};

// Staff hủy giao dịch tại cuộc hẹn (trường hợp C)
export const cancelContractTransaction = async (
  req: Request,
  res: Response
) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body; // Lý do hủy (bắt buộc)
    const staffId = req.user?.id;

    // Kiểm tra quyền staff
    const isStaff = req.user?.role === "staff" || req.user?.role === "admin";
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền hủy giao dịch",
      });
    }

    // Kiểm tra lý do hủy
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp lý do hủy giao dịch",
      });
    }

    // Kiểm tra appointment tồn tại
    const appointment = await Appointment.findById(appointmentId).populate(
      "depositRequestId"
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    // Kiểm tra trạng thái
    if (appointment.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Không thể hủy giao dịch đã hoàn thành",
      });
    }

    if (appointment.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Giao dịch đã bị hủy trước đó",
      });
    }

    // Hoàn tiền từ escrow về ví người mua với phí hủy (80% tiền đặt cọc về buyer, 20% về system)
    // Tiền đặt cọc = 10% giá xe, khi hủy: hoàn 8% giá xe (80% tiền đặt cọc) về buyer, 2% giá xe (20% tiền đặt cọc) về system
    const depositRequest = appointment.depositRequestId as any;
    await walletService.refundFromEscrowWithCancellationFee(
      depositRequest._id.toString()
    );

    // Cập nhật trạng thái listing về Published để có thể bán lại
    const listing = await Listing.findById(depositRequest.listingId);
    if (listing && listing.status === "InTransaction") {
      listing.status = "Published";
      await listing.save();
    }

    // Cập nhật trạng thái appointment
    appointment.status = "CANCELLED";
    appointment.cancelledAt = new Date();
    appointment.notes = reason
      ? `${
          appointment.notes ? appointment.notes + "\n" : ""
        }[Hủy bởi Staff] Lý do: ${reason}`
      : appointment.notes;
    await appointment.save();

    // Cập nhật DepositRequest status
    const depositRequestDoc = await DepositRequest.findById(depositRequest._id);
    if (depositRequestDoc) {
      depositRequestDoc.status = "CANCELLED";
      await depositRequestDoc.save();
    }

    // Cập nhật hợp đồng nếu có
    const contract = await Contract.findOne({ appointmentId });
    if (contract) {
      contract.status = "CANCELLED";
      await contract.save();
    }

    // Gửi email thông báo cho buyer và seller
    try {
      const buyer = await User.findById(appointment.buyerId);
      const seller = await User.findById(appointment.sellerId);
      const listing = await Listing.findById(depositRequest.listingId);

      if (buyer && seller && listing) {
        // Gửi email cho buyer
        await emailService.sendTransactionCancelledToBuyerNotification(
          appointment.buyerId.toString(),
          seller,
          appointment,
          reason,
          listing
        );

        // Gửi email cho seller
        await emailService.sendTransactionCancelledToSellerNotification(
          appointment.sellerId.toString(),
          buyer,
          appointment,
          reason,
          listing
        );
      }

      console.log(
        `Staff ${staffId} đã hủy giao dịch ${appointmentId}. Lý do: ${reason}`
      );
      console.log(
        `Buyer: ${buyer?.fullName || appointment.buyerId}, Seller: ${
          seller?.fullName || appointment.sellerId
        }`
      );
    } catch (notificationError) {
      console.error(
        "Error sending cancellation notification:",
        notificationError
      );
      // Không throw error để không ảnh hưởng đến flow chính
    }

    res.json({
      success: true,
      message: "Hủy giao dịch thành công, tiền đã hoàn về ví người mua",
      data: {
        appointmentId: appointment._id,
        status: appointment.status,
        cancelledAt: appointment.cancelledAt,
        reason: reason,
        cancelledBy: staffId,
      },
    });
  } catch (error: any) {
    console.error("Error cancelling contract transaction:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error?.message || "Unknown error",
    });
  }
};
