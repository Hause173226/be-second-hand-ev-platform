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
    const { fullName, phone, email, password, ...rest } = userData;

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
      role: "user", // mặc định
      ...rest,
    });

    const userObj = user.toObject() as any;
    delete userObj.password;
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

  /**
   * Đăng nhập:
   * - Không lọc theo role trong truy vấn.
   * - Nếu client truyền role => so sánh sau khi tìm thấy user.
   */
  signIn: async (email: string, password: string, role?: string) => {
    const emailNorm = normalizeEmail(email);

    // luôn select password/role những field có thể đặt select:false trong schema
    const user = await User.findOne({ email: emailNorm }).select(
      "+password +role +refreshToken +isActive +emailVerified"
    );

    if (!user) throw new Error("Email hoặc mật khẩu không đúng");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Email hoặc mật khẩu không đúng");

    // Nếu client yêu cầu đăng nhập với role cụ thể thì kiểm tra khớp
    if (role && user.role !== role) {
      throw new Error("Quyền truy cập không phù hợp với tài khoản");
    }

    // Nếu bạn có các cờ kiểm soát khác thì bật kiểm tra ở đây:
    // if (user.isActive === false) throw new Error("Tài khoản đang bị khóa");
    // if (user.emailVerified === false) throw new Error("Email chưa xác minh");

    const { accessToken, refreshToken } = await userService.generateTokens(user);

    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.refreshToken;

    return {
      user: userObj,
      accessToken,
      refreshToken,
    };
  },

  refreshToken: async (refreshToken: string) => {
    if (!refreshToken) throw new Error("Refresh token is required");

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
        userId: string;
      };

      const user = await User.findOne({
        _id: decoded.userId,
        refreshToken: refreshToken,
      }).select("+refreshToken");

      if (!user) throw new Error("Invalid refresh token");

      const tokens = await userService.generateTokens(user);
      return tokens;
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
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

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

    if (updateData.password) {
      throw new Error("Sử dụng changePassword để đổi mật khẩu");
    }
    if (updateData.isActive !== undefined) {
      throw new Error("Sử dụng changeUserStatus để thay đổi trạng thái");
    }

    Object.keys(updateData).forEach((key) => {
      if (
        updateData[key] !== undefined &&
        updateData[key] !== null &&
        key !== "password" &&
        key !== "isActive" &&
        key !== "refreshToken"
      ) {
        (user as any)[key] = updateData[key];
      }
    });

    await user.save();
    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.refreshToken;
    return userObj;
  },

  changePassword: async (
    userId: string,
    currentPassword: string,
    newPassword: string
  ) => {
    const user = await User.findById(userId).select("+password +refreshToken");
    if (!user) throw new Error("User not found");

    const isCurrentPasswordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordMatch) {
      throw new Error("Current password is incorrect");
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new Error("Mật khẩu mới phải khác mật khẩu hiện tại");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.refreshToken = undefined;

    await user.save();
    return { message: "Đổi mật khẩu thành công" };
  },
};
