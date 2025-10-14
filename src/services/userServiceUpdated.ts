// src/services/userServiceUpdated.ts
import { User } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { profileService } from "./profileService";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "your_refresh_token_secret";
const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "7d";

// Helper functions
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const userServiceUpdated = {
  signUp: async (userData: any) => {
    const { fullName, phone, email, password, ...rest } = userData;

    if (!fullName) {
      throw new Error("Thiếu fullName bắt buộc");
    }
    if (!phone) {
      throw new Error("Thiếu phone bắt buộc");
    }
    if (!email) {
      throw new Error("Thiếu email bắt buộc");
    }
    if (!password) {
      throw new Error("Thiếu password bắt buộc");
    }

    const existingUser = await User.findOne({
      $or: [{ phone }, { email }],
    });
    if (existingUser) {
      throw new Error("Số điện thoại hoặc email đã tồn tại");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo OTP cho email verification
    const otp = generateOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    const user = await User.create({
      fullName,
      phone,
      email,
      password: hashedPassword,
      role: "user",
      isActive: false, // Chưa active cho đến khi verify email
      otpCode: otp,
      otpExpires: expires,
      ...rest,
    });

    // Gửi email verification
    await transporter.sendMail({
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: "Xác thực tài khoản - Second Hand EV Platform",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Xác thực tài khoản</h2>
          <p>Xin chào ${fullName},</p>
          <p>Cảm ơn bạn đã đăng ký tài khoản tại Second Hand EV Platform!</p>
          <p>Mã xác thực của bạn là: <strong style="font-size: 24px; color: #007bff;">${otp}</strong></p>
          <p>Mã này có hiệu lực trong 15 phút.</p>
          <p>Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">© 2025 Second Hand EV Platform</p>
        </div>
      `,
    });

    // Tạo profile rỗng cho user mới
    try {
      await profileService.createEmptyProfile(user._id.toString());
      console.log(`✅ Profile created for user: ${user._id}`);
    } catch (profileError) {
      console.error("❌ Error creating profile:", profileError);
      // Không throw error vì user đã được tạo thành công
    }

    // Xóa password và OTP trước khi trả về
    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.otpCode;
    delete userObj.otpExpires;

    return {
      user: userObj,
      message:
        "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.",
    };
  },

  signUpWithPhone: async (userData: any) => {
    const { fullName, phone } = userData;

    if (!fullName) {
      throw new Error("Thiếu fullName bắt buộc");
    }
    if (!phone) {
      throw new Error("Thiếu phone bắt buộc");
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      throw new Error("Số điện thoại đã tồn tại");
    }

    // Tạo OTP cho phone verification
    const otp = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    const user = await User.create({
      fullName,
      phone,
      password: "", // Password rỗng cho phone auth
      role: "user",
      isActive: false, // Chưa active cho đến khi verify phone
      otpCode: otp,
      otpExpires: expires,
    });

    // Gửi SMS OTP (Mock)
    await sendOTPSMS(phone, otp);

    // Tạo profile rỗng cho user mới
    try {
      await profileService.createEmptyProfile(user._id.toString());
      console.log(`✅ Profile created for phone user: ${user._id}`);
    } catch (profileError) {
      console.error("❌ Error creating profile:", profileError);
      // Không throw error vì user đã được tạo thành công
    }

    // Xóa password và OTP trước khi trả về
    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.otpCode;
    delete userObj.otpExpires;

    return {
      user: userObj,
      message:
        "Đăng ký thành công! Vui lòng kiểm tra SMS để xác thực tài khoản.",
    };
  },
};

// Mock SMS service
const sendOTPSMS = async (phone: string, otp: string) => {
  try {
    // Format phone number (add +84 for Vietnam)
    const formattedPhone = phone.startsWith("+")
      ? phone
      : `+84${phone.replace(/^0/, "")}`;

    // Mock SMS - chỉ log ra console để test
    console.log(`📱 SMS Mock: Gửi OTP ${otp} đến ${formattedPhone}`);
    console.log(
      `📱 Nội dung: "Mã xác thực của bạn là: ${otp}. Mã có hiệu lực trong 5 phút."`
    );

    return true;
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw new Error("Không thể gửi SMS. Vui lòng kiểm tra số điện thoại.");
  }
};
