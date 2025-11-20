import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import Handlebars from "handlebars";
import PDFDocument from "pdfkit";
import { v2 as cloudinary } from "cloudinary";
import { IContract } from "../models/Contract";
import { ContractType, CONTRACT_TYPES } from "../constants/contractTimeline";
import { deleteByPublicId } from "./cloudinaryService";

// Đường dẫn font hỗ trợ tiếng Việt
const FONT_REGULAR = path.resolve(
  process.cwd(),
  "src/fonts/NotoSans-Regular.ttf"
);
const FONT_BOLD = path.resolve(process.cwd(), "src/fonts/NotoSans-Bold.ttf");

type TemplateCache = Record<ContractType, HandlebarsTemplateDelegate | null>;

export type ContractPdfContext = {
  buyerContact?: {
    email?: string;
    phone?: string;
  };
  sellerContact?: {
    email?: string;
    phone?: string;
  };
  staffContact?: {
    email?: string;
  };
};

const TEMPLATE_PATHS: Record<ContractType, string> = {
  DEPOSIT: path.resolve(
    process.cwd(),
    "src/templates/contracts/depositContract.hbs"
  ),
  FULL_PAYMENT: path.resolve(
    process.cwd(),
    "src/templates/contracts/fullPaymentContract.hbs"
  ),
};

const templateCache: TemplateCache = {
  DEPOSIT: null,
  FULL_PAYMENT: null,
};

Handlebars.registerHelper("currency", (value: number) => {
  if (typeof value !== "number") return value;
  return value.toLocaleString("vi-VN");
});

Handlebars.registerHelper("formatDate", (value?: Date | string) => {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("vi-VN");
});

// Helper chuyển số thành chữ (đơn giản, có thể mở rộng sau)
Handlebars.registerHelper("numberToWords", (value: number) => {
  if (typeof value !== "number") return "";
  // Tạm thời trả về số bằng chữ đơn giản, có thể tích hợp thư viện sau
  const units = [
    "",
    "một",
    "hai",
    "ba",
    "bốn",
    "năm",
    "sáu",
    "bảy",
    "tám",
    "chín",
  ];
  const tens = [
    "",
    "mười",
    "hai mươi",
    "ba mươi",
    "bốn mươi",
    "năm mươi",
    "sáu mươi",
    "bảy mươi",
    "tám mươi",
    "chín mươi",
  ];

  if (value === 0) return "không";
  if (value < 10) return units[value];
  if (value < 100) {
    const ten = Math.floor(value / 10);
    const unit = value % 10;
    return tens[ten] + (unit > 0 ? " " + units[unit] : "");
  }

  // Với số lớn, tạm thời trả về format đơn giản
  const millions = Math.floor(value / 1000000);
  const thousands = Math.floor((value % 1000000) / 1000);
  const remainder = value % 1000;

  let result = "";
  if (millions > 0) result += `${millions} triệu `;
  if (thousands > 0) result += `${thousands} nghìn `;
  if (remainder > 0) result += `${remainder}`;

  return result.trim() || value.toString();
});

async function loadTemplate(contractType: ContractType) {
  if (templateCache[contractType]) {
    return templateCache[contractType]!;
  }

  const templateContent = await fs.readFile(
    TEMPLATE_PATHS[contractType],
    "utf-8"
  );
  const compiled = Handlebars.compile(templateContent);
  templateCache[contractType] = compiled;
  return compiled;
}

function buildTemplateData(contract: IContract, context?: ContractPdfContext) {
  const appointmentDate = contract.contractDate;
  const remainingAmount = contract.purchasePrice - contract.depositAmount;
  const penaltyAmount = Math.round(contract.depositAmount * 0.5);
  const systemFee = Math.round(contract.depositAmount * 0.2);
  const sellerFee = Math.round(contract.depositAmount * 0.3);
  const refundAmount = Math.round(contract.depositAmount * 0.5);

  return {
    contractNumber: contract.contractNumber,
    contractDate: appointmentDate,
    location: "Showroom Secondhand EV Marketplace", // Có thể lấy từ appointment sau
    purchasePrice: contract.purchasePrice,
    depositAmount: contract.depositAmount,
    remainingAmount: remainingAmount,
    penaltyAmount: penaltyAmount,
    systemFee: systemFee,
    sellerFee: sellerFee,
    refundAmount: refundAmount,
    paymentDeadline:
      contract.contractType === "DEPOSIT"
        ? new Date(
            (appointmentDate ? appointmentDate.getTime() : Date.now()) +
              7 * 24 * 60 * 60 * 1000
          )
        : appointmentDate,
    notarizationDeadline: new Date(
      (appointmentDate ? appointmentDate.getTime() : Date.now()) +
        2 * 24 * 60 * 60 * 1000
    ),
    buyer: {
      name: contract.buyerName,
      idNumber: contract.buyerIdNumber,
      idIssuedDate: contract.buyerIdIssuedDate || contract.contractDate,
      idIssuedBy: contract.buyerIdIssuedBy || "Cơ quan có thẩm quyền",
      address: contract.buyerAddress,
      email: context?.buyerContact?.email || "",
      phone: context?.buyerContact?.phone || "",
    },
    seller: {
      name: contract.sellerName,
      idNumber: contract.sellerIdNumber,
      idIssuedDate: contract.sellerIdIssuedDate || contract.contractDate,
      idIssuedBy: contract.sellerIdIssuedBy || "Cơ quan có thẩm quyền",
      address: contract.sellerAddress,
      email: context?.sellerContact?.email || "",
      phone: context?.sellerContact?.phone || "",
    },
    vehicle: {
      brand: contract.vehicleBrand,
      model: contract.vehicleModel,
      year: contract.manufactureYear,
      type: contract.vehicleType,
      color: contract.vehicleColor,
      licensePlate: contract.licensePlate,
      engineNumber: contract.engineNumber,
      chassisNumber: contract.chassisNumber,
      engineDisplacement: 0, // Có thể lấy từ listing sau
      registrationNumber: contract.registrationNumber || "N/A",
      registrationIssuedBy:
        contract.registrationIssuedBy || "Cơ quan có thẩm quyền",
      registrationIssuedDate:
        contract.registrationIssuedDate || contract.contractDate,
    },
    staff: {
      name: contract.staffName || "Chưa xác định",
      email: context?.staffContact?.email || "",
    },
  };
}

async function renderPdfBuffer(contract: IContract, body: string) {
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      // Kiểm tra và đọc font file
      let fontRegularBuffer: Buffer | null = null;
      let fontBoldBuffer: Buffer | null = null;

      try {
        if (fsSync.existsSync(FONT_REGULAR)) {
          fontRegularBuffer = fsSync.readFileSync(FONT_REGULAR);
          console.log(`[PDF] Loaded font: ${FONT_REGULAR}`);
        } else {
          console.warn(
            `[PDF] Font file not found: ${FONT_REGULAR}, using Helvetica`
          );
        }
      } catch (error) {
        console.warn(`[PDF] Error reading font file ${FONT_REGULAR}:`, error);
      }

      try {
        if (fsSync.existsSync(FONT_BOLD)) {
          fontBoldBuffer = fsSync.readFileSync(FONT_BOLD);
          console.log(`[PDF] Loaded font: ${FONT_BOLD}`);
        } else {
          console.warn(
            `[PDF] Font file not found: ${FONT_BOLD}, using Helvetica-Bold`
          );
        }
      } catch (error) {
        console.warn(`[PDF] Error reading font file ${FONT_BOLD}:`, error);
      }

      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", (err: Error) => {
        console.error("[PDF] PDFDocument error:", err);
        reject(err);
      });
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // Register font hỗ trợ tiếng Việt nếu có
      let fontRegularExists = false;
      let fontBoldExists = false;

      if (fontRegularBuffer && fontBoldBuffer) {
        try {
          doc.registerFont("NotoSans", fontRegularBuffer);
          doc.registerFont("NotoSansBold", fontBoldBuffer);
          fontRegularExists = true;
          fontBoldExists = true;
          console.log(
            "[PDF] ✅ Successfully registered Noto Sans fonts for Vietnamese support"
          );
        } catch (fontError) {
          console.warn(
            "[PDF] Failed to register Noto Sans font, using Helvetica:",
            fontError
          );
          fontRegularExists = false;
          fontBoldExists = false;
        }
      } else {
        console.warn(
          "[PDF] Font files not available, using Helvetica (may not support Vietnamese)"
        );
      }

      // Set font mặc định (Noto Sans nếu có, nếu không thì dùng Helvetica)
      const defaultFont = fontRegularExists ? "NotoSans" : "Helvetica";
      const boldFont = fontBoldExists ? "NotoSansBold" : "Helvetica-Bold";

      try {
        doc.font(defaultFont).fontSize(11);
        console.log(`[PDF] Using default font: ${defaultFont}`);
      } catch (fontError) {
        console.error("[PDF] Error setting font:", fontError);
        // Fallback to Helvetica
        doc.font("Helvetica").fontSize(11);
      }

      const lines = body.split("\n");

      lines.forEach((line) => {
        const trimmedLine = line.trim();

        if (trimmedLine.length === 0) {
          doc.moveDown(0.3);
          return;
        }

        try {
          // Xử lý tiêu đề chính
          if (trimmedLine.includes("HỢP ĐỒNG MUA BÁN XE")) {
            doc
              .fontSize(16)
              .font(boldFont)
              .text(trimmedLine, { align: "center" });
            doc.fontSize(11).font(defaultFont);
            doc.moveDown(0.5);
          }
          // Xử lý ĐIỀU (heading)
          else if (trimmedLine.match(/^ĐIỀU \d+\./)) {
            doc.moveDown(0.3);
            doc.fontSize(12).font(boldFont).text(trimmedLine);
            doc.fontSize(11).font(defaultFont);
            doc.moveDown(0.2);
          }
          // Xử lý BÊN A, BÊN B (sub-heading)
          else if (
            trimmedLine.match(/^BÊN [AB]/) ||
            trimmedLine.match(/^[A-Z][A-Z\s]+:$/)
          ) {
            doc.fontSize(11).font(boldFont).text(trimmedLine);
            doc.fontSize(11).font(defaultFont);
            doc.moveDown(0.1);
          }
          // Xử lý text thường
          else {
            // Đảm bảo font được set đúng trước khi render
            doc.font(defaultFont).fontSize(11);
            // Xử lý indent (dòng bắt đầu bằng dấu cách hoặc dấu gạch)
            const isIndented =
              line.startsWith("   ") ||
              line.startsWith("-") ||
              line.startsWith("  ");
            doc.text(trimmedLine, {
              align: isIndented ? "left" : "justify",
              lineGap: 2,
              continued: false,
            });
          }
        } catch (textError) {
          console.warn(
            `[PDF] Error rendering line: "${trimmedLine.substring(0, 50)}..."`,
            textError
          );
          // Fallback: render với font mặc định
          try {
            doc.font("Helvetica").fontSize(11).text(trimmedLine);
          } catch (fallbackError) {
            console.error(`[PDF] Fallback font also failed:`, fallbackError);
            // Skip this line if both fail
          }
        }
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateContractPdf(
  contract: IContract,
  context?: ContractPdfContext
) {
  try {
    const type: ContractType = CONTRACT_TYPES.includes(contract.contractType)
      ? contract.contractType
      : "DEPOSIT";

    console.log(`[PDF] Loading template for type: ${type}`);
    const template = await loadTemplate(type);

    console.log(
      `[PDF] Building template data for contract: ${contract.contractNumber}`
    );
    const data = buildTemplateData(contract, context);

    console.log(`[PDF] Rendering template...`);
    const body = template(data);

    // Validate body không rỗng
    if (!body || body.trim().length === 0) {
      throw new Error("Template rendered empty content");
    }

    console.log(`[PDF] Template body length: ${body.length}`);
    console.log(`[PDF] First 200 chars: ${body.substring(0, 200)}`);

    console.log(`[PDF] Rendering PDF buffer...`);
    const pdfBuffer = await renderPdfBuffer(contract, body);
    console.log(`[PDF] PDF buffer size: ${pdfBuffer.length} bytes`);

    if (contract.contractPdfPublicId) {
      console.log(`[PDF] Deleting old PDF: ${contract.contractPdfPublicId}`);
      try {
        await deleteByPublicId(contract.contractPdfPublicId, "raw");
      } catch (deleteError) {
        console.warn(
          `[PDF] Failed to delete old PDF (non-critical):`,
          deleteError
        );
      }
    }

    console.log(`[PDF] Uploading to Cloudinary...`);
    // Upload PDF trực tiếp với Cloudinary SDK để đảm bảo access_mode: "public"
    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "secondhand-ev/contracts/pdf",
          resource_type: "raw",
          public_id: `contract-${contract.contractNumber}`,
          overwrite: true,
          access_mode: "public",
          type: "upload",
          invalidate: true,
        },
        (error, result) => {
          if (error) {
            console.error(`[PDF] Cloudinary upload error:`, error);
            reject(error);
          } else if (result) {
            console.log(`[PDF] Upload successful: ${result.secure_url}`);
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
            });
          } else {
            reject(new Error("Upload failed: no result"));
          }
        }
      );
      uploadStream.end(pdfBuffer);
    });

    console.log(`[PDF] PDF generation completed successfully`);
    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    };
  } catch (error: any) {
    console.error(`[PDF] Error in generateContractPdf:`, error);
    console.error(`[PDF] Contract ID: ${contract._id}`);
    console.error(`[PDF] Contract Number: ${contract.contractNumber}`);
    console.error(`[PDF] Error stack:`, error?.stack);
    throw error;
  }
}
