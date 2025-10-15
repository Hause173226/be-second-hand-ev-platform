import { User } from "../models/User";
import bcrypt from "bcryptjs";
import { log } from "console";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "your_refresh_token_secret";
const ACCESS_TOKEN_EXPIRY = "1h"; // Changed to 1 hour
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days

const transporter = nodemailer.createTransport({
  service: "gmail", // Hoặc dịch vụ email khác
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendOTPEmail = async (to: string, otp: string) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USERNAME, // Phải đồng bộ với user ở trên
      to,
      subject: "Mã xác thực đặt lại mật khẩu",
      text: `Mã OTP của bạn là: ${otp}`,
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
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

    // Trong production, có thể lưu OTP vào database để admin xem
    // await OTPLog.create({ phone: formattedPhone, otp, timestamp: new Date() });

    return true;
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw new Error("Không thể gửi SMS. Vui lòng kiểm tra số điện thoại.");
  }
};

const generateOTP = (length = 6) => {
  return Math.floor(100000 + Math.random() * 900000)
    .toString()
    .substring(0, length);
};

export const userService = {
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
          <p style="color: #666; font-size: 12px;">© 2024 Second Hand EV Platform</p>
        </div>
      `,
    });

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

  generateTokens: async (user: any) => {
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign({ userId: user._id }, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    // Store refresh token in database
    user.refreshToken = refreshToken;
    await user.save();

    return { accessToken, refreshToken };
  },

  signIn: async (email: string, password: string, role?: string) => {
    // Nếu không truyền role thì mặc định là "user"
    const userRole = role || "user";
    const user = await User.findOne({ email, role: userRole });
    if (!user)
      throw new Error("Email, mật khẩu hoặc quyền truy cập không đúng");

    // Kiểm tra user có password không
    if (!user.password) {
      throw new Error("Tài khoản này chưa có mật khẩu");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      throw new Error("Email, mật khẩu hoặc quyền truy cập không đúng");

    const { accessToken, refreshToken } = await userService.generateTokens(
      user
    );

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
    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
        userId: string;
      };

      // Find user with this refresh token
      const user = await User.findOne({
        _id: decoded.userId,
        refreshToken: refreshToken,
      });

      if (!user) {
        throw new Error("Invalid refresh token");
      }

      // Generate new tokens
      const tokens = await userService.generateTokens(user);

      return tokens;
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  },

  signOut: async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Clear refresh token
    user.refreshToken = undefined;
    await user.save();

    return { message: "Đăng xuất thành công" };
  },

  sendForgotPasswordOTP: async (email: string) => {
    const user = await User.findOne({ email });
    if (!user) throw new Error("Email không tồn tại");

    const otp = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    user.otpCode = otp;
    user.otpExpires = expires;
    await user.save();

    await sendOTPEmail(email, otp);

    return { message: "OTP đã được gửi về email" };
  },

  resendForgotPasswordOTP: async (email: string) => {
    // Gửi lại OTP mới
    return await userService.sendForgotPasswordOTP(email);
  },

  verifyOTPAndResetPassword: async (
    email: string,
    otp: string,
    newPassword: string
  ) => {
    const user = await User.findOne({
      email,
      otpCode: otp,
      otpExpires: { $gt: new Date() },
    });
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
    if (!user) {
      throw new Error("User not found");
    }
    // Remove password before returning
    const userObj = user as any;
    delete userObj.password;
    return userObj;
  },

  updateUser: async (userId: string, updateData: any) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Ngăn không cho cập nhật password trực tiếp
    if (updateData.password) {
      throw new Error("Sử dụng changePassword để đổi mật khẩu");
    }

    // Ngăn không cho cập nhật trạng thái trực tiếp
    if (updateData.isActive !== undefined) {
      throw new Error("Sử dụng changeUserStatus để thay đổi trạng thái");
    }

    // Chỉ cập nhật những field được truyền lên và không phải undefined/null
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
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Kiểm tra user có password không
    if (!user.password) {
      throw new Error("Tài khoản này chưa có mật khẩu");
    }

    // Kiểm tra mật khẩu hiện tại có đúng không
    const isCurrentPasswordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordMatch) {
      throw new Error("Current password is incorrect");
    }

    // Kiểm tra mật khẩu mới không trùng với mật khẩu hiện tại
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
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

  // ===== PHONE AUTHENTICATION METHODS =====

  // Đăng ký bằng số điện thoại
  signUpWithPhone: async (userData: any) => {
    const { fullName, phone, ...rest } = userData;

    if (!fullName) {
      throw new Error("Thiếu fullName bắt buộc");
    }
    if (!phone) {
      throw new Error("Thiếu phone bắt buộc");
    }

    // Kiểm tra phone đã tồn tại chưa
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      throw new Error("Số điện thoại đã tồn tại");
    }

    // Tạo OTP cho xác thực
    const otp = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    // Tạo user với trạng thái chưa active
    const user = await User.create({
      fullName,
      phone,
      password: "", // Không cần password cho phone auth
      role: "user",
      isActive: false, // Chưa active cho đến khi verify OTP
      otpCode: otp,
      otpExpires: expires,
      ...rest,
    });

    // Gửi OTP qua SMS
    await sendOTPSMS(phone, otp);

    // Xóa password và OTP trước khi trả về
    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.otpCode;
    delete userObj.otpExpires;

    return {
      user: userObj,
      message: "OTP đã được gửi về số điện thoại của bạn",
    };
  },

  // Xác thực OTP cho đăng ký bằng phone
  verifyPhoneOTP: async (phone: string, otp: string) => {
    const user = await User.findOne({
      phone,
      otpCode: otp,
      otpExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new Error("OTP không hợp lệ hoặc đã hết hạn");
    }

    // Active user và xóa OTP
    user.isActive = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Tạo tokens
    const { accessToken, refreshToken } = await userService.generateTokens(
      user
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.refreshToken;

    return {
      user: userObj,
      accessToken,
      refreshToken,
      message: "Xác thực thành công",
    };
  },

  // Đăng nhập bằng số điện thoại (gửi OTP)
  signInWithPhone: async (phone: string) => {
    const user = await User.findOne({ phone, isActive: true });
    if (!user) {
      throw new Error("Số điện thoại không tồn tại hoặc chưa được kích hoạt");
    }

    // Tạo OTP mới
    const otp = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    user.otpCode = otp;
    user.otpExpires = expires;
    await user.save();

    // Gửi OTP qua SMS
    await sendOTPSMS(phone, otp);

    return { message: "OTP đã được gửi về số điện thoại của bạn" };
  },

  // Xác thực OTP cho đăng nhập bằng phone
  verifySignInOTP: async (phone: string, otp: string) => {
    const user = await User.findOne({
      phone,
      otpCode: otp,
      otpExpires: { $gt: new Date() },
      isActive: true,
    });

    if (!user) {
      throw new Error("OTP không hợp lệ hoặc đã hết hạn");
    }

    // Xóa OTP
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Tạo tokens
    const { accessToken, refreshToken } = await userService.generateTokens(
      user
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.refreshToken;

    return {
      user: userObj,
      accessToken,
      refreshToken,
      message: "Đăng nhập thành công",
    };
  },

  // Gửi lại OTP cho phone
  resendPhoneOTP: async (phone: string) => {
    const user = await User.findOne({ phone });
    if (!user) {
      throw new Error("Số điện thoại không tồn tại");
    }

    const otp = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    user.otpCode = otp;
    user.otpExpires = expires;
    await user.save();

    await sendOTPSMS(phone, otp);

    return { message: "OTP mới đã được gửi về số điện thoại của bạn" };
  },

  // ===== EMAIL VERIFICATION FOR SIGNUP =====

  // Gửi email verification sau khi đăng ký
  sendEmailVerification: async (email: string) => {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Email không tồn tại");
    }

    if (user.isActive) {
      throw new Error("Tài khoản đã được kích hoạt");
    }

    const otp = generateOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    user.otpCode = otp;
    user.otpExpires = expires;
    await user.save();

    // Gửi email verification
    await transporter.sendMail({
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: "Xác thực tài khoản - Second Hand EV Platform",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Xác thực tài khoản</h2>
          <p>Xin chào ${user.fullName},</p>
          <p>Cảm ơn bạn đã đăng ký tài khoản tại Second Hand EV Platform!</p>
          <p>Mã xác thực của bạn là: <strong style="font-size: 24px; color: #007bff;">${otp}</strong></p>
          <p>Mã này có hiệu lực trong 15 phút.</p>
          <p>Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">© 2025 Second Hand EV Platform</p>
        </div>
      `,
    });

    return { message: "Email xác thực đã được gửi" };
  },

  // Xác thực email
  verifyEmail: async (email: string, otp: string) => {
    const user = await User.findOne({
      email,
      otpCode: otp,
      otpExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new Error("OTP không hợp lệ hoặc đã hết hạn");
    }

    // Active user và xóa OTP
    user.isActive = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Tạo tokens
    const { accessToken, refreshToken } = await userService.generateTokens(
      user
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    delete userObj.refreshToken;

    return {
      user: userObj,
      accessToken,
      refreshToken,
      message: "Email đã được xác thực thành công",
    };
  },
};
