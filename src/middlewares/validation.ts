// src/middlewares/validation.ts
import { Request, Response, NextFunction } from "express";
import { validation } from "../utils/validation";

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

  // Validate terms agreement
  const termsValidation = validation.validateTermsAgreement(termsAgreed);
  if (!termsValidation.isValid) {
    res.status(400).json({ error: termsValidation.message });
    return;
  }

  next();
};

export const validateSignUpPhone = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { fullName, phone } = req.body;

  // Validate full name
  const fullNameValidation = validation.validateFullName(fullName);
  if (!fullNameValidation.isValid) {
    res.status(400).json({ error: fullNameValidation.message });
    return;
  }

  // Validate phone
  if (!validation.validatePhone(phone)) {
    res
      .status(400)
      .json({ error: "Số điện thoại không đúng định dạng (VD: 0987654321)" });
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
