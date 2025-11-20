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
import auctionDepositService from "../services/auctionDepositService";
import axios from "axios";
import dealServiceInstance from "../services/dealService";

type ContractContext = {
  appointment: any;
  listing: any;
  listingId: string;
  buyer: any;
  seller: any;
  depositAmount: number;
  purchasePrice: number;
  depositRequestId?: string;
  auctionId?: string;
};

const STAFF_ROLES = ["staff", "admin"];

function isStaff(user?: { role?: string | null }) {
  return !!user && STAFF_ROLES.includes(user.role ?? "");
}

export const createContract = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { contractType = "DEPOSIT", contractTerms } = req.body as {
      contractType?: ContractType;
      contractTerms?: string;
    };

    if (!isStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền tạo hợp đồng",
      });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate("depositRequestId")
      .populate({
        path: "auctionId",
        populate: {
          path: "listingId",
        },
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    const existingContract = await Contract.findOne({ appointmentId });
    if (existingContract) {
      return res.status(400).json({
        success: false,
        message: "Lịch hẹn này đã có hợp đồng",
      });
    }

    const appointmentDealId = appointment.dealId ?? undefined;

    const context = await resolveContractContext(appointment);
    const normalizedContractType: ContractType = CONTRACT_TYPES.includes(
      (contractType as ContractType) ?? "DEPOSIT"
    )
      ? (contractType as ContractType) ?? "DEPOSIT"
      : "DEPOSIT";

    const contract = new Contract({
      appointmentId,
      depositRequestId: context.depositRequestId,
      auctionId: context.auctionId,
      buyerId: appointment.buyerId,
      sellerId: appointment.sellerId,
      listingId: context.listingId,
      dealId: appointmentDealId,
      contractNumber: `CT-${Date.now()}`,
      contractDate: new Date(),
      buyerName: context.buyer.fullName || context.buyer.email,
      buyerIdNumber: context.buyer.citizenId || "N/A",
      buyerIdIssuedDate: context.buyer.citizenIdIssuedDate || new Date(),
      buyerIdIssuedBy:
        context.buyer.citizenIdIssuedBy || "Cơ quan có thẩm quyền",
      buyerAddress: context.buyer.address?.fullAddress || "N/A",
      sellerName: context.seller.fullName || context.seller.email,
      sellerIdNumber: context.seller.citizenId || "N/A",
      sellerIdIssuedDate: context.seller.citizenIdIssuedDate || new Date(),
      sellerIdIssuedBy:
        context.seller.citizenIdIssuedBy || "Cơ quan có thẩm quyền",
      sellerAddress: context.seller.address?.fullAddress || "N/A",
      vehicleBrand:
        context.listing.make || (context.listing as any).brand || "N/A",
      vehicleModel: context.listing.model || "N/A",
      vehicleType:
        context.listing.vehicleType || (context.listing as any).type || "N/A",
      vehicleColor:
        context.listing.paintColor || (context.listing as any).color || "N/A",
      engineNumber: context.listing.engineNumber || "N/A",
      chassisNumber: context.listing.chassisNumber || "N/A",
      seatCount: context.listing.seatCount || 2,
      manufactureYear: context.listing.year || new Date().getFullYear(),
      licensePlate: context.listing.licensePlate || "N/A",
      registrationNumber: context.listing.registrationNumber || "N/A",
      registrationIssuedDate: context.listing.registrationDate || new Date(),
      registrationIssuedBy:
        context.listing.registrationIssuedBy || "Cơ quan có thẩm quyền",
      registrationIssuedTo: context.listing.registrationIssuedTo || "N/A",
      registrationAddress: context.listing.registrationAddress || "N/A",
      purchasePrice: context.purchasePrice,
      depositAmount: context.depositAmount,
      paymentMethod: "Escrow",
      status: "DRAFT",
      staffId: req.user?.id,
      staffName: req.user?.name || req.user?.email,
      contractType: normalizedContractType,
      contractTerms,
      paperworkTimeline: buildDefaultTimeline(normalizedContractType),
    });

    await contract.save();

    if (appointmentDealId) {
      const contractId = (contract._id as any)?.toString?.();
      if (contractId) {
        try {
          await dealServiceInstance.linkContract(
            appointmentDealId,
            contractId
          );
        } catch (err) {
          console.error("Error linking deal with contract:", err);
        }
      }
    }

    if (appointment.type !== "CONTRACT_SIGNING") {
      appointment.type = "CONTRACT_SIGNING";
      await appointment.save();
    }

    res.json({
      success: true,
      message: "Tạo hợp đồng thành công",
      data: contract,
    });
  } catch (error: any) {
    console.error("Error creating contract:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error?.message || "Unknown error",
    });
  }
};

async function resolveContractContext(
  appointment: any
): Promise<ContractContext> {
  let listing: any | null = null;
  let listingId: string | undefined;
  let depositRequestId: string | undefined;
  let auctionId: string | undefined;
  let depositAmount = 0;
  let purchasePrice = 0;

  if (appointment.appointmentType === "AUCTION" && appointment.auctionId) {
    const auction = appointment.auctionId as any;
    if (!auction || !auction.listingId) {
      throw new Error("Không tìm thấy thông tin auction hoặc listingId");
    }
    listing = auction.listingId;
    listingId = listing._id?.toString() ?? listing.id;
    auctionId = auction._id?.toString() ?? auction.id;
    depositAmount = auctionDepositService.getParticipationFee(auction);
    purchasePrice = auction.winningBid?.price || auction.startingPrice || 0;
  } else {
    const depositRequest = appointment.depositRequestId as any;
    if (depositRequest && depositRequest.listingId) {
      depositRequestId = depositRequest._id?.toString() ?? depositRequest.id;
      listingId =
        depositRequest.listingId?.toString() ?? depositRequest.listingId;
      listing = await Listing.findById(listingId);
      depositAmount = depositRequest.depositAmount || 0;
      purchasePrice = listing?.priceListed || listing?.price || 0;
    } else if (appointment.listingId) {
      listingId = appointment.listingId?.toString();
      listing = await Listing.findById(listingId);
      if (!listing) {
        throw new Error("Không tìm thấy thông tin listing cho lịch hẹn này");
      }
      purchasePrice = listing.priceListed || listing.price || 0;
      depositAmount = Math.round((purchasePrice || 0) * 0.1);
    } else {
      throw new Error("Không tìm thấy thông tin depositRequest hoặc listingId");
    }
  }

  if (!listing) {
    throw new Error("Không tìm thấy thông tin xe");
  }

  const buyer = appointment.buyerId?._id
    ? appointment.buyerId
    : await User.findById(appointment.buyerId);
  const seller = appointment.sellerId?._id
    ? appointment.sellerId
    : await User.findById(appointment.sellerId);

  if (!buyer || !seller) {
    throw new Error("Không tìm thấy thông tin người mua/bán");
  }

  return {
    appointment,
    listing,
    listingId: listingId || listing._id?.toString(),
    buyer,
    seller,
    depositAmount,
    purchasePrice,
    depositRequestId,
    auctionId,
  };
}

function ensureTimeline(contract: any, contractType?: ContractType) {
  if (!contract.paperworkTimeline || contract.paperworkTimeline.length === 0) {
    contract.paperworkTimeline = buildDefaultTimeline(
      contractType || contract.contractType || "DEPOSIT"
    );
  }
}

function applyTimelineAutoProgress(contract: any) {
  if (!contract.paperworkTimeline) return;

  // ✅ Tự động unlock bước tiếp theo khi bước trước đó hoàn thành
  for (let i = 0; i < contract.paperworkTimeline.length - 1; i += 1) {
    const current = contract.paperworkTimeline[i];
    const next = contract.paperworkTimeline[i + 1];

    // Nếu bước hiện tại đã DONE và bước tiếp theo đang PENDING hoặc BLOCKED
    // → Chuyển bước tiếp theo thành PENDING (trừ khi nó đã là DONE)
    if (
      current.status === "DONE" &&
      next.status !== "DONE" &&
      next.status !== "IN_PROGRESS"
    ) {
      // Với DEPOSIT: chỉ unlock các bước làm giấy tờ sau khi thanh toán đủ 100%
      // Logic này sẽ được xử lý ở chỗ khác khi thanh toán đủ 100%
      // Ở đây chỉ unlock cho FULL_PAYMENT hoặc nếu đã unlock rồi
      if (
        contract.contractType === "FULL_PAYMENT" ||
        next.status !== "BLOCKED"
      ) {
        next.status = "PENDING";
      }
    }
  }
}
import {
  CONTRACT_TYPES,
  buildDefaultTimeline,
  ContractTimelineAttachment,
  ContractTimelineStatus,
  ContractTimelineStepId,
  ContractType,
  isValidTimelineStatus,
  isValidTimelineStep,
} from "../constants/contractTimeline";
import { generateContractPdf as buildContractPdfFile } from "../services/contractPdfService";
import { log } from "console";

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
          path: "listingId",
        },
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

    const context = await resolveContractContext(appointment);
    const listing = context.listing;
    const depositAmount = context.depositAmount;
    const finalPrice = context.purchasePrice;

    const buyerProfile = context.buyer;
    const sellerProfile = context.seller;

    // Tìm contract nếu có
    const contract = await Contract.findOne({ appointmentId }).select(
      "_id contractNumber status contractType"
    );
    const contractId = contract ? (contract._id as any).toString() : null;

    res.json({
      success: true,
      message: "Lấy thông tin hợp đồng thành công",
      contractId: contractId,
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
          path: "listingId",
        },
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    const appointmentDealId = appointment.dealId ?? undefined;

    const allowedStatuses = [
      "CONFIRMED",
      "AWAITING_REMAINING_PAYMENT",
      "COMPLETED",
      "CONTRACT_SIGNING",
    ];
    if (!allowedStatuses.includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Lịch hẹn phải đang được xử lý (đã xác nhận/thanh toán) mới được upload ảnh",
      });
    }

    const context = await resolveContractContext(appointment);
    const listingId = context.listingId;
    const depositRequestId = context.depositRequestId ?? null;

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
      const context = await resolveContractContext(appointment);

      contract = new Contract({
        appointmentId,
        depositRequestId: depositRequestId ?? context.depositRequestId,
        auctionId:
          appointment.appointmentType === "AUCTION"
            ? appointment.auctionId
            : context.auctionId,
        buyerId: appointment.buyerId,
        sellerId: appointment.sellerId,
        listingId: listingId,
        contractNumber: `CT-${Date.now()}`,
        contractDate: new Date(),
        dealId: appointmentDealId,
        buyerName: context.buyer.fullName || context.buyer.email,
        buyerIdNumber: context.buyer.citizenId || "N/A",
        buyerIdIssuedDate: context.buyer.citizenIdIssuedDate || new Date(),
        buyerIdIssuedBy:
          context.buyer.citizenIdIssuedBy || "Cơ quan có thẩm quyền",
        buyerAddress: context.buyer.address?.fullAddress || "N/A",
        sellerName: context.seller.fullName || context.seller.email,
        sellerIdNumber: context.seller.citizenId || "N/A",
        sellerIdIssuedDate: context.seller.citizenIdIssuedDate || new Date(),
        sellerIdIssuedBy:
          context.seller.citizenIdIssuedBy || "Cơ quan có thẩm quyền",
        sellerAddress: context.seller.address?.fullAddress || "N/A",
        vehicleBrand:
          context.listing.make || (context.listing as any).brand || "N/A",
        vehicleModel: context.listing.model || "N/A",
        vehicleType:
          context.listing.vehicleType || (context.listing as any).type || "N/A",
        vehicleColor:
          context.listing.paintColor || (context.listing as any).color || "N/A",
        engineNumber: context.listing.engineNumber || "N/A",
        chassisNumber: context.listing.chassisNumber || "N/A",
        seatCount: context.listing.seatCount || 2,
        manufactureYear: context.listing.year || new Date().getFullYear(),
        licensePlate: context.listing.licensePlate || "N/A",
        registrationNumber: context.listing.registrationNumber || "N/A",
        registrationIssuedDate: context.listing.registrationDate || new Date(),
        registrationIssuedBy:
          context.listing.registrationIssuedBy || "Cơ quan có thẩm quyền",
        registrationIssuedTo: context.listing.registrationIssuedTo || "N/A",
        registrationAddress: context.listing.registrationAddress || "N/A",
        purchasePrice: context.purchasePrice,
        depositAmount: context.depositAmount,
        paymentMethod: "Escrow",
        status: "SIGNED",
        signedAt: new Date(),
        staffId: staffId!,
        staffName: req.user?.name || req.user?.email,
        contractPhotos: uploadedPhotos,
        contractType:
          context.appointment.appointmentType === "NORMAL_DEPOSIT"
            ? "DEPOSIT"
            : "FULL_PAYMENT",
        paperworkTimeline: buildDefaultTimeline(
          context.appointment.appointmentType === "NORMAL_DEPOSIT"
            ? "DEPOSIT"
            : "FULL_PAYMENT"
        ),
      });
    } else {
      // ✅ Replace toàn bộ ảnh cũ bằng ảnh mới (không append)
      contract.contractPhotos = uploadedPhotos as any;
      contract.status = "SIGNED";
      contract.signedAt = new Date();
      contract.staffId = staffId!;
      contract.staffName = req.user?.name || req.user?.email;
      if (appointmentDealId && contract.dealId !== appointmentDealId) {
        contract.dealId = appointmentDealId;
      }
    }

    ensureTimeline(contract, contract.contractType || "DEPOSIT");
    const signStep = contract.paperworkTimeline.find(
      (item) => item.step === "SIGN_CONTRACT"
    );
    if (signStep) {
      signStep.status = "DONE";
      signStep.updatedAt = new Date();
      signStep.updatedBy = staffId!;
      const attachments: ContractTimelineAttachment[] = uploadedPhotos.map(
        (photo) => ({
          url: photo.url,
          publicId: photo.publicId,
          description: photo.description,
          uploadedAt: photo.uploadedAt,
          uploadedBy: staffId!,
        })
      );
      signStep.attachments = [...signStep.attachments, ...attachments];
    }

    applyTimelineAutoProgress(contract);
    await contract.save();

    if (appointmentDealId) {
      const contractId = (contract._id as any)?.toString?.();
      const appointmentIdForDeal = contract.appointmentId?.toString();
      const dealAttachments = uploadedPhotos.map((photo) => ({
        url: photo.url,
        description: photo.description,
        uploadedAt: photo.uploadedAt,
      }));
      if (contractId) {
        try {
          await dealServiceInstance.linkContract(
            appointmentDealId,
            contractId
          );
        } catch (err) {
          console.error(
            "Error linking deal with contract after uploading photos:",
            err
          );
        }
      }

      try {
        await dealServiceInstance.updatePaperworkStep(
          appointmentDealId,
          "SIGN_CONTRACT",
          {
            status: "DONE",
            note: "Staff uploaded signed contract photos",
            appointmentId: appointmentIdForDeal,
            attachments: dealAttachments,
          }
        );
      } catch (err) {
        console.error(
          "Error syncing deal paperwork after contract photo upload:",
          err
        );
      }
    }

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

// Staff upload ảnh ký hợp đồng (theo từng bên BUYER/SELLER) vào bước SIGN_CONTRACT của timeline
export const uploadContractSignature = async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const userId = req.user?.id;
    const { party } = req.body as { party?: "BUYER" | "SELLER" };

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    // Chỉ staff/admin mới được quyền upload chữ ký
    if (!isStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền upload ảnh ký hợp đồng",
      });
    }

    if (!party || (party !== "BUYER" && party !== "SELLER")) {
      return res.status(400).json({
        success: false,
        message: "Thiếu hoặc sai tham số 'party' (BUYER hoặc SELLER)",
      });
    }

    // Tìm contract
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất 1 ảnh hợp đồng đã ký",
      });
    }

    if (files.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Cần upload chính xác 6 ảnh ký hợp đồng",
        currentCount: files.length,
      });
    }

    // Đảm bảo timeline đã được khởi tạo
    ensureTimeline(contract, contract.contractType || "DEPOSIT");

    // Tìm bước SIGN_CONTRACT trong timeline
    const timelineStep = contract.paperworkTimeline.find(
      (item: any) => item.step === "SIGN_CONTRACT"
    );

    if (!timelineStep) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy bước ký hợp đồng trong timeline",
      });
    }

    const uploadedAttachments: ContractTimelineAttachment[] = [];

    for (const file of files) {
      try {
        if (!file.buffer || file.buffer.length === 0) {
          console.error("Empty file buffer:", file.originalname);
          continue;
        }

        const uploadResult = await uploadFromBuffer(
          file.buffer,
          `contract-signature-${contractId}-${Date.now()}`,
          {
            folder: "secondhand-ev/contracts/signatures",
            resource_type: "image",
          }
        );

        const attachment: ContractTimelineAttachment = {
          url: uploadResult.secureUrl,
          publicId: uploadResult.publicId,
          // Ghi rõ bên ký trong description để FE phân biệt BUYER/SELLER
          description:
            `[${party}] ` + (file.originalname || "Ảnh hợp đồng đã ký"),
          uploadedAt: new Date(),
          uploadedBy: userId,
        };

        timelineStep.attachments.push(attachment);
        uploadedAttachments.push(attachment);
      } catch (uploadError) {
        console.error("Error uploading signature photo:", uploadError);
        // Tiếp tục với các file khác
      }
    }

    if (uploadedAttachments.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Không thể upload ảnh nào",
      });
    }

    // Nếu bước đang PENDING thì chuyển sang IN_PROGRESS để staff biết là đã có ảnh chờ duyệt
    if (timelineStep.status === "PENDING") {
      timelineStep.status = "IN_PROGRESS";
    }
    timelineStep.updatedAt = new Date();
    timelineStep.updatedBy = userId;

    await contract.save();
    if (contract.dealId) {
      try {
        await dealServiceInstance.updatePaperworkStep(contract.dealId, "SIGN_CONTRACT", {
          status: timelineStep.status,
          note: `Đã upload chữ ký ${party}`,
          appointmentId: contract.appointmentId?.toString(),
          attachments: uploadedAttachments.map((att) => ({
            url: att.url,
            description: att.description,
            uploadedAt: att.uploadedAt,
          })),
        });
      } catch (err) {
        console.error("Error updating deal paperwork after signature upload:", err);
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Upload ảnh ký hợp đồng thành công. Đang chờ nhân viên xác nhận hoàn thành.",
      data: {
        contractId: contract._id,
        step: "SIGN_CONTRACT",
        status: timelineStep.status,
        attachments: uploadedAttachments.map((att) => ({
          url: att.url,
          description: att.description,
          uploadedAt: att.uploadedAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error uploading contract signature:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi upload ảnh ký hợp đồng",
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
          path: "listingId",
        },
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

    const context = await resolveContractContext(appointment);

    // Xác định loại appointment và xử lý tương ứng
    const isAuction =
      appointment.appointmentType === "AUCTION" && appointment.auctionId;
    let listingId = context.listingId || contract.listingId?.toString();

    if (isAuction) {
      // Appointment từ đấu giá - Không cần chuyển tiền từ escrow vì đã xử lý khi đấu giá
      const auction = appointment.auctionId as any;
      listingId =
        listingId || auction?.listingId?._id?.toString() || auction?.listingId;

      console.log(
        "✅ Completing auction transaction - no escrow transfer needed"
      );
    } else {
      const depositRequest = appointment.depositRequestId as any;
      if (depositRequest && depositRequest._id) {
        const linkedListing = depositRequest.listingId;
        if (linkedListing) {
          if (typeof linkedListing === "object") {
            listingId =
              linkedListing._id?.toString() ??
              linkedListing.id?.toString() ??
              listingId;
          } else {
            listingId = linkedListing.toString();
          }
        }
        await walletService.completeTransaction(depositRequest._id);
      } else {
        console.log(
          "⚠️ No depositRequest attached to appointment, skip escrow transfer"
        );
      }
    }

    if (!listingId) {
      return res.status(400).json({
        success: false,
        message: "Không xác định được listing cho giao dịch",
      });
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
    // Lưu thông tin staff xử lý giao dịch
    contract.staffId = staffId!;
    contract.staffName = req.user?.name || req.user?.email;
    ensureTimeline(contract, contract.contractType || "DEPOSIT");
    const handoverStep = contract.paperworkTimeline.find(
      (item) => item.step === "HANDOVER_PAPERS_AND_CAR"
    );
    if (handoverStep) {
      handoverStep.status = "DONE";
      handoverStep.updatedAt = new Date();
      handoverStep.updatedBy = staffId!;
    }
    applyTimelineAutoProgress(contract);
    await contract.save();

    // Cập nhật trạng thái appointment
    appointment.status = "COMPLETED";
    appointment.completedAt = new Date();
    await appointment.save();

    // Cập nhật DepositRequest status từ IN_ESCROW sang COMPLETED (chỉ cho trường hợp deposit thông thường, không phải auction)
    if (!isAuction && appointment.depositRequestId) {
      const depositRequestId =
        (appointment.depositRequestId as any)?._id ||
        appointment.depositRequestId;
      if (depositRequestId) {
        const depositRequestDoc = await DepositRequest.findById(
          depositRequestId
        );
        if (depositRequestDoc && depositRequestDoc.status === "IN_ESCROW") {
          depositRequestDoc.status = "COMPLETED";
          await depositRequestDoc.save();
          console.log(
            `✅ Updated deposit request ${depositRequestId} status from IN_ESCROW to COMPLETED`
          );
        }
      }
    }

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

export const getContractTimeline = async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const contract = await Contract.findById(contractId).populate({
      path: "appointmentId",
      populate: [
        { path: "buyerId", select: "_id email name" },
        { path: "sellerId", select: "_id email name" },
      ],
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    const userId = req.user?.id;

    // ✅ Kiểm tra quyền: staff hoặc buyer/seller
    const isStaffUser = isStaff(req.user);

    let isBuyer = false;
    let isSeller = false;

    if (!isStaffUser && contract.appointmentId) {
      const appointment = contract.appointmentId as any;
      // Kiểm tra từ appointment (giống logic trong getContractInfo)
      isBuyer =
        (appointment.buyerId as any)?._id?.toString() === userId ||
        (appointment.buyerId as any)?.toString() === userId ||
        contract.buyerId?.toString() === userId;
      isSeller =
        (appointment.sellerId as any)?._id?.toString() === userId ||
        (appointment.sellerId as any)?.toString() === userId ||
        contract.sellerId?.toString() === userId;
    } else if (!isStaffUser) {
      // Fallback: kiểm tra từ contract nếu không có appointment
      isBuyer = contract.buyerId?.toString() === userId;
      isSeller = contract.sellerId?.toString() === userId;
    }

    // const canView = isStaffUser || isBuyer || isSeller;

    // if (!canView) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Bạn không có quyền xem timeline hợp đồng này",
    //   });
    // }

    ensureTimeline(contract, contract.contractType || "DEPOSIT");

    res.json({
      success: true,
      message: "Lấy timeline hợp đồng thành công",
      data: contract.paperworkTimeline,
    });
  } catch (error: any) {
    console.error("Error getting contract timeline:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error?.message || "Unknown error",
    });
  }
};

export const updateContractTimelineStep = async (
  req: Request,
  res: Response
) => {
  try {
    const { contractId, step } = req.params;
    const { status, note, dueDate } = req.body as {
      status?: ContractTimelineStatus;
      note?: string;
      dueDate?: string;
    };

    if (!isStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền cập nhật timeline",
      });
    }

    if (!isValidTimelineStep(step)) {
      return res.status(400).json({
        success: false,
        message: "Bước timeline không hợp lệ",
      });
    }

    if (status && !isValidTimelineStatus(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái timeline không hợp lệ",
      });
    }

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    ensureTimeline(contract, contract.contractType || "DEPOSIT");

    const timelineStep = contract.paperworkTimeline.find(
      (item) => item.step === (step as ContractTimelineStepId)
    );

    if (!timelineStep) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy bước timeline",
      });
    }

    if (status) {
      timelineStep.status = status;
      if (status === "DONE" && step === "SIGN_CONTRACT") {
        contract.status =
          contract.status === "DRAFT" ? "SIGNED" : contract.status;
        contract.signedAt = contract.signedAt || new Date();
      }
    }

    if (note !== undefined) {
      timelineStep.note = note;
    }

    if (dueDate !== undefined) {
      timelineStep.dueDate = dueDate ? new Date(dueDate) : undefined;
    }

    timelineStep.updatedAt = new Date();
    timelineStep.updatedBy = req.user?.id;

    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      for (const file of files) {
        if (!file.buffer || file.buffer.length === 0) {
          continue;
        }

        const uploadResult = await uploadFromBuffer(
          file.buffer,
          `contract-${contractId}-${Date.now()}`,
          {
            folder: "secondhand-ev/contracts/timeline",
            resource_type: "image",
          }
        );

        const attachment: ContractTimelineAttachment = {
          url: uploadResult.secureUrl,
          publicId: uploadResult.publicId,
          description: file.originalname,
          uploadedAt: new Date(),
          uploadedBy: req.user?.id || "staff",
        };

        timelineStep.attachments.push(attachment);
      }
    }

    applyTimelineAutoProgress(contract);
    await contract.save();

    res.json({
      success: true,
      message: "Cập nhật timeline thành công",
      data: contract.paperworkTimeline,
    });
  } catch (error: any) {
    console.error("Error updating contract timeline:", error);
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
    if (depositRequest && depositRequest._id) {
      await walletService.refundFromEscrowWithCancellationFee(
        depositRequest._id.toString()
      );
    } else {
      console.log(
        "⚠️ No depositRequest attached to appointment, skip escrow refund"
      );
    }

    let listingId: string | undefined;
    if (depositRequest?.listingId) {
      if (typeof depositRequest.listingId === "object") {
        listingId =
          depositRequest.listingId._id?.toString() ||
          depositRequest.listingId.id?.toString();
      } else {
        listingId = depositRequest.listingId.toString();
      }
    } else if (appointment.listingId) {
      listingId = appointment.listingId.toString();
    }

    // Cập nhật trạng thái listing về Published để có thể bán lại
    let listing = listingId ? await Listing.findById(listingId) : null;
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
    if (depositRequest && depositRequest._id) {
      const depositRequestDoc = await DepositRequest.findById(
        depositRequest._id
      );
      if (depositRequestDoc) {
        depositRequestDoc.status = "CANCELLED";
        await depositRequestDoc.save();
      }
    }

    // Cập nhật hợp đồng nếu có
    const contract = await Contract.findOne({ appointmentId });
    if (contract) {
      contract.status = "CANCELLED";
      // Lưu thông tin staff xử lý hủy giao dịch
      contract.staffId = staffId!;
      contract.staffName = req.user?.name || req.user?.email;
      await contract.save();
    }

    // Gửi email thông báo cho buyer và seller
    try {
      const buyer = await User.findById(appointment.buyerId);
      const seller = await User.findById(appointment.sellerId);
      if (!listing && listingId) {
        listing = await Listing.findById(listingId);
      }

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

export const generateContractPdfFile = async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;

    if (!isStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền tạo file PDF hợp đồng",
      });
    }

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    // ✅ Validate contract data trước khi tạo PDF
    if (!contract.buyerId || !contract.sellerId || !contract.listingId) {
      return res.status(400).json({
        success: false,
        message:
          "Hợp đồng thiếu thông tin cần thiết (buyerId, sellerId, hoặc listingId)",
      });
    }

    if (!contract.buyerName || !contract.sellerName) {
      return res.status(400).json({
        success: false,
        message: "Hợp đồng thiếu thông tin người mua/bán",
      });
    }

    console.log(`[PDF Generation] Starting for contract ${contractId}`);
    console.log(`[PDF Generation] Contract type: ${contract.contractType}`);
    console.log(`[PDF Generation] Contract number: ${contract.contractNumber}`);

    const [buyerUser, sellerUser] = await Promise.all([
      User.findById(contract.buyerId).select("email phone fullName"),
      User.findById(contract.sellerId).select("email phone fullName"),
    ]);

    console.log(
      `[PDF Generation] Buyer: ${buyerUser?.email || contract.buyerName}`
    );
    console.log(
      `[PDF Generation] Seller: ${sellerUser?.email || contract.sellerName}`
    );

    const pdf = await buildContractPdfFile(contract, {
      buyerContact: {
        email: buyerUser?.email,
        phone: buyerUser?.phone,
      },
      sellerContact: {
        email: sellerUser?.email,
        phone: sellerUser?.phone,
      },
      staffContact: {
        email: req.user?.email || req.user?.name,
      },
    });

    console.log(`[PDF Generation] PDF created successfully: ${pdf.url}`);

    contract.contractPdfUrl = pdf.url;
    contract.contractPdfPublicId = pdf.publicId;
    await contract.save();

    res.json({
      success: true,
      message: "Tạo file hợp đồng thành công",
      data: {
        contractId: contract._id,
        contractPdfUrl: contract.contractPdfUrl,
      },
    });
  } catch (error: any) {
    console.error("❌ Error generating contract PDF:", error);
    console.error("❌ Contract ID:", req.params.contractId);
    console.error("❌ Error stack:", error?.stack);
    console.error("❌ Error details:", {
      message: error?.message,
      name: error?.name,
      code: error?.code,
    });

    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo PDF",
      error: error?.message || "Unknown error",
      details:
        process.env.NODE_ENV === "development" ? error?.stack : undefined,
    });
  }
};

export const getContractPdfFile = async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    const userId = req.user?.id;
    const canView =
      isStaff(req.user) ||
      contract.buyerId?.toString() === userId ||
      contract.sellerId?.toString() === userId;

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập file hợp đồng này",
      });
    }

    if (!contract.contractPdfUrl) {
      return res.status(404).json({
        success: false,
        message: "Chưa có file PDF, vui lòng tạo trước",
      });
    }

    // ✅ Tự động download file PDF khi gọi API
    try {
      // Fetch file PDF từ Cloudinary
      const response = await axios.get(contract.contractPdfUrl, {
        responseType: "arraybuffer",
      });

      // Set headers để browser tự động download file PDF
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="hop-dong-${contract.contractNumber}.pdf"`
      );
      res.setHeader("Content-Length", response.data.length);

      // Gửi file PDF về client
      return res.send(Buffer.from(response.data));
    } catch (fetchError: any) {
      console.error("Error fetching PDF from Cloudinary:", fetchError);
      // Nếu không fetch được, fallback: redirect đến URL
      return res.redirect(contract.contractPdfUrl);
    }
  } catch (error: any) {
    console.error("Error getting contract PDF:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error?.message || "Unknown error",
    });
  }
};
