// src/middlewares/validation.ts
import { Request, Response, NextFunction } from "express";
import { validation } from "../utils/validation";

/** Utils nhỏ: ép giá trị truthy/falsey từ form (kể cả multipart) về boolean */
function toBoolean(value: any): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  }
  return null;
}

/* -------------------- AUTH VALIDATORS (giữ nguyên) -------------------- */

export const validateSignUp = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { fullName, phone, email, password, termsAgreed } = req.body;

  // Validate full name
  const fullNameValidation = validation.validateFullName(fullName);
  if (!fullNameValidation.isValid) {
    res.status(400).json({ error: fullNameValidation.message });
    return;
  }

  // Validate email
  if (!validation.validateEmail(email)) {
    res.status(400).json({ error: "Email không đúng định dạng" });
    return;
  }

  // Validate phone
  if (!validation.validatePhone(phone)) {
    res
      .status(400)
      .json({ error: "Số điện thoại không đúng định dạng (VD: 0987654321)" });
    return;
  }

  // Validate password
  const passwordValidation = validation.validatePassword(password);
  if (!passwordValidation.isValid) {
    res.status(400).json({ error: passwordValidation.message });
    return;
  }

  // Validate terms agreement (điều khoản đăng ký)
  const termsValidation = validation.validateTermsAgreement(termsAgreed);
  if (!termsValidation.isValid) {
    res.status(400).json({ error: termsValidation.message });
    return;
  }

  next();
};

export const validateOTP = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { otp } = req.body;

  const otpValidation = validation.validateOTP(otp);
  if (!otpValidation.isValid) {
    res.status(400).json({ error: otpValidation.message });
    return;
  }

  next();
};

export const validateSignIn = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password } = req.body;

  // Validate email
  if (!validation.validateEmail(email)) {
    res.status(400).json({ error: "Email không đúng định dạng" });
    return;
  }

  // Validate password
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
    return;
  }

  next();
};

/* -------------------- LISTING VALIDATORS (mới) -------------------- */

/**
 * Bắt buộc người bán phải chấp nhận điều khoản & phí hoa hồng khi tạo listing.
 * FE/Swagger gửi field: commissionTermsAccepted = true (hoặc "true")
 */
export const validateCreateListing = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // parse commissionTermsAccepted từ body (hỗ trợ multipart/form-data)
  const acceptedRaw = (req.body as any)?.commissionTermsAccepted;
  const accepted = toBoolean(acceptedRaw);

  if (accepted !== true) {
    res.status(400).json({
      success: false,
      error:
        "Bạn phải chấp nhận Điều khoản & Phí hoa hồng để đăng bán trên nền tảng.",
      field: "commissionTermsAccepted",
    });
    return;
  }

  // set lại body cho rõ ràng & controller dùng luôn
  req.body.commissionTermsAccepted = true;
  req.body.commissionTermsAcceptedAt = new Date().toISOString();

  next();
};
