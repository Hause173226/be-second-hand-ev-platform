// src/services/userService.ts
import { User } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "your_refresh_token_secret";
const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "7d";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendOTPEmail = async (to: string, otp: string) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USERNAME,
      to,
      subject: "Mã xác thực đặt lại mật khẩu",
      text: `Mã OTP của bạn là: ${otp}`,
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

const generateOTP = (length = 6) =>
  Math.floor(100000 + Math.random() * 900000)
    .toString()
    .substring(0, length);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const userService = {
  signUp: async (userData: any) => {
    const {
      fullName,
      phone,
      email,
      password,
      gender,
      dateOfBirth,
      avatar,
      addresses,
      ...rest
    } = userData;

    if (!fullName) throw new Error("Thiếu fullName bắt buộc");
    if (!phone) throw new Error("Thiếu phone bắt buộc");
    if (!email) throw new Error("Thiếu email bắt buộc");
    if (!password) throw new Error("Thiếu password bắt buộc");

    const emailNorm = normalizeEmail(email);

    const existingUser = await User.findOne({
      $or: [{ phone }, { email: emailNorm }],
    });
    if (existingUser) throw new Error("Số điện thoại hoặc email đã tồn tại");

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      phone,
      email: emailNorm,
      password: hashedPassword,
      role: "user",
      roles: ["user"], // Sync với role
      gender,
      dateOfBirth,
      avatar,
      addresses: addresses || undefined,
      stats: {
        soldCount: 0,
        buyCount: 0,
        cancelRate: 0,
        responseTime: 0,
        completionRate: 0,
      },
      role: "user", // mặc định
      ...rest,
    });

    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.passwordHash;
    delete userObj.roles; // Chỉ giữ role (string)
    return userObj;
  },

  generateTokens: async (user: any) => {
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign({ userId: user._id }, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    user.refreshToken = refreshToken;
    await user.save();

    return { accessToken, refreshToken };
  },

  signIn: async (email: string, password: string, role?: string) => {
    const emailNorm = normalizeEmail(email);

    const user = await User.findOne({ email: emailNorm }).select(
      "+password +role +refreshToken +isActive +emailVerified"
    );
    if (!user) throw new Error("Email hoặc mật khẩu không đúng");

    const userPassword = user.password || user.passwordHash;
    if (!userPassword) throw new Error("Tài khoản không có mật khẩu hợp lệ");

    const isMatch = await bcrypt.compare(password, userPassword);
    if (!isMatch) throw new Error("Email hoặc mật khẩu không đúng");

    if (role && user.role !== role)
      throw new Error("Quyền truy cập không phù hợp với tài khoản");

    const { accessToken, refreshToken } = await userService.generateTokens(user);

    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.refreshToken;
    delete userObj.roles; // Chỉ giữ role (string)

    return { user: userObj, accessToken, refreshToken };
  },

  refreshToken: async (refreshToken: string) => {
    if (!refreshToken) throw new Error("Refresh token is required");

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
        userId: string;
      };

      const user = await User.findOne({
        _id: decoded.userId,
        refreshToken,
      }).select("+refreshToken");

      if (!user) throw new Error("Invalid refresh token");

      return await userService.generateTokens(user);
    } catch {
      throw new Error("Invalid refresh token");
    }
  },

  signOut: async (userId: string) => {
    const user = await User.findById(userId).select("+refreshToken");
    if (!user) throw new Error("User not found");

    user.refreshToken = undefined;
    await user.save();

    return { message: "Đăng xuất thành công" };
  },

  sendForgotPasswordOTP: async (email: string) => {
    const emailNorm = normalizeEmail(email);
    const user = await User.findOne({ email: emailNorm });
    if (!user) throw new Error("Email không tồn tại");

    const otp = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    user.otpCode = otp;
    user.otpExpires = expires;
    await user.save();

    await sendOTPEmail(emailNorm, otp);
    return { message: "OTP đã được gửi về email" };
  },

  resendForgotPasswordOTP: async (email: string) => {
    return await userService.sendForgotPasswordOTP(email);
  },

  verifyOTPAndResetPassword: async (
    email: string,
    otp: string,
    newPassword: string
  ) => {
    const emailNorm = normalizeEmail(email);
    const user = await User.findOne({
      email: emailNorm,
      otpCode: otp,
      otpExpires: { $gt: new Date() },
    }).select("+password");

    if (!user) throw new Error("OTP không hợp lệ hoặc đã hết hạn");

    user.password = await bcrypt.hash(newPassword, 10);
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    return { message: "Đặt lại mật khẩu thành công" };
  },

  getAllUsers: async () => {
    const users = await User.find({ isActive: true }).lean();
    return users;
  },

  getUserById: async (userId: string) => {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");
    const userObj = user as any;
    delete userObj.password;
    return userObj;
  },

  updateUser: async (userId: string, updateData: any) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (updateData.password)
      throw new Error("Sử dụng changePassword để đổi mật khẩu");
    if (updateData.isActive !== undefined)
      throw new Error("Sử dụng changeUserStatus để thay đổi trạng thái");

    Object.keys(updateData).forEach((key) => {
      if (
        updateData[key] !== undefined &&
        updateData[key] !== null &&
        !["password", "isActive", "refreshToken"].includes(key)
      ) {
        (user as any)[key] = updateData[key];
      }
    });

    await user.save();
    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.refreshToken;
    delete userObj.roles; // Chỉ giữ role (string)
    return userObj;
  },

  changePassword: async (
    userId: string,
    currentPassword: string,
    newPassword: string
  ) => {
    const user = await User.findById(userId).select("+password +refreshToken");
    if (!user) throw new Error("User not found");

    // Kiểm tra mật khẩu hiện tại có đúng không
    const userPassword = user.password || user.passwordHash;
    if (!userPassword) {
      throw new Error("User password not found");
    }

    const isCurrentPasswordMatch = await bcrypt.compare(
      currentPassword,
      userPassword
    );
    if (!isCurrentPasswordMatch) {
      throw new Error("Current password is incorrect");
    }

    // Kiểm tra mật khẩu mới không trùng với mật khẩu hiện tại
    const isSamePassword = await bcrypt.compare(newPassword, userPassword);
    if (isSamePassword) {
      throw new Error("Mật khẩu mới phải khác mật khẩu hiện tại");
    }

    // Hash mật khẩu mới và lưu
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Xóa refresh token để buộc user đăng nhập lại (tùy chọn)
    user.refreshToken = undefined;

    await user.save();

    return { message: "Đổi mật khẩu thành công" };
  },

  deleteUser: async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Soft delete: Cập nhật status thành "DELETED"
    user.status = "DELETED";
    user.isActive = false;
    await user.save();

    return { message: "User đã được xóa thành công" };
  },

  sendEmailVerification: async (email: string) => {
    const user = await User.findOne({ email });
    if (!user) throw new Error("Email không tồn tại");

    const otp = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    user.otpCode = otp;
    user.otpExpires = expires;
    await user.save();

    await sendOTPEmail(email, otp);

    return { message: "Mã xác thực đã được gửi về email" };
  },

  verifyEmail: async (email: string, otp: string) => {
    const user = await User.findOne({
      email,
      otpCode: otp,
      otpExpires: { $gt: new Date() },
    });
    if (!user) throw new Error("OTP không hợp lệ hoặc đã hết hạn");

    user.emailVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    return { message: "Xác thực email thành công" };
  },
};
    const userPassword = user.password || user
