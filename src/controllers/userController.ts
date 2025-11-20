import { Request, Response } from "express";
import { userService } from "../services/userService";
import { uploadFromBuffer } from "../services/cloudinaryService";
import { membershipService } from "../services/membershipService";
import { MembershipPackage } from "../models/MembershipPackage";
import { User } from "../models/User";

export const signUp = async (req: Request, res: Response) => {
  try {
    // Xử lý upload avatar nếu có
    let avatarUrl = req.body.avatar; // URL từ form data

    if (req.file) {
      // Upload avatar to Cloudinary instead of local storage
      const uploadResult = await uploadFromBuffer(
        req.file.buffer,
        `avatar-signup-${Date.now()}`,
        {
          folder: "secondhand-ev/profiles/avatars",
          resource_type: "image",
        }
      );
      avatarUrl = uploadResult.secureUrl;
    }

    // Xử lý address nếu là JSON string
    let address = req.body.address;
    if (typeof address === "string") {
      try {
        address = JSON.parse(address);
      } catch (parseErr) {
        res.status(400).json({ error: "Địa chỉ không đúng định dạng JSON" });
        return;
      }
    }

    // Tạo user data với avatar và address đã parse
    const userData = {
      ...req.body,
      avatar: avatarUrl,
      address: address,
    };

    // Tạo user
    const user = await userService.signUp(userData);

    // TỰ ĐỘNG GÁN GÓI FREE CHO USER MỚI
    try {
      const freePackage = await MembershipPackage.findOne({
        slug: "free",
        isActive: true,
      });

      if (freePackage) {
        await membershipService.purchasePackage(
          String(user.user._id),
          String(freePackage._id)
        );
      }
    } catch (membershipError) {
      // Không fail toàn bộ signup nếu gán membership thất bại
      console.error("Failed to assign FREE membership:", membershipError);
    }

    res.status(201).json(user);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const signIn = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Thiếu email hoặc mật khẩu" });
      return;
    }

    // 🔍 Lấy user theo email để kiểm tra trạng thái
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      res.status(400).json({ error: "Email hoặc mật khẩu không đúng" });
      return;
    }

    // 🔥 CHECK TRẠNG THÁI TÀI KHOẢN
    if (user.status === "SUSPENDED" || user.status === "DELETED") {
      res.status(403).json({
        code: "ACCOUNT_DISABLED",
        message:
          "Tài khoản của bạn đã bị khoá. Vui lòng liên hệ bộ phận hỗ trợ hoặc quản trị viên.",
      });
      return;
    }

    // Nếu tài khoản đang ACTIVE → dùng service signIn để kiểm tra mật khẩu + tạo token
    const result = await userService.signIn(email, password);

    res.json(result);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: "Refresh token is required" });
      return;
    }
    const tokens = await userService.refreshToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    if (err instanceof Error) {
      res.status(401).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Vui lòng nhập email" });
      return;
    }
    const result = await userService.sendForgotPasswordOTP(email);
    res.json(result);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Lỗi server" });
  }
};

export const resendOTP = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Vui lòng nhập email" });
      return;
    }
    const result = await userService.resendForgotPasswordOTP(email);
    res.json(result);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Lỗi server" });
  }
};

export const resetPasswordWithOTP = async (
  req: Request,
  res: Response
) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      res.status(400).json({ error: "Thiếu thông tin" });
      return;
    }
    const result = await userService.verifyOTPAndResetPassword(
      email,
      otp,
      newPassword
    );
    res.json(result);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Lỗi server" });
  }
};

export const signOut = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    if (!userId) {
      res.status(401).json({ error: "Không có thông tin user" });
      return;
    }
    await userService.signOut(userId);
    res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await userService.getUserById(userId);
    res.status(200).json(user);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "User not found") {
        res.status(404).json({ error: "Không tìm thấy người dùng" });
      } else {
        res.status(400).json({ error: err.message });
      }
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    const updatedUser = await userService.updateUser(userId, req.body);
    res.status(200).json(updatedUser);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "User not found") {
        res.status(404).json({ error: "Không tìm thấy người dùng" });
      } else {
        res.status(400).json({ error: err.message });
      }
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) {
      res.status(400).json({ error: "Mật khẩu hiện tại là bắt buộc" });
      return;
    }

    if (!newPassword) {
      res.status(400).json({ error: "Mật khẩu mới là bắt buộc" });
      return;
    }

    if (newPassword.length < 6) {
      res
        .status(400)
        .json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
      return;
    }

    if (currentPassword === newPassword) {
      res
        .status(400)
        .json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại" });
      return;
    }

    const result = await userService.changePassword(
      userId,
      currentPassword,
      newPassword
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "User not found") {
        res.status(404).json({ error: "Không tìm thấy người dùng" });
      } else if (err.message === "Current password is incorrect") {
        res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
      } else {
        res.status(400).json({ error: err.message });
      }
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId; // Lấy từ JWT token
    const user = await userService.getUserById(userId);
    res.status(200).json(user);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "User not found") {
        res.status(404).json({ error: "Không tìm thấy người dùng" });
      } else {
        res.status(400).json({ error: err.message });
      }
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

// ===== EMAIL VERIFICATION CONTROLLERS =====

export const sendEmailVerification = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Thiếu email" });
      return;
    }

    const result = await userService.sendEmailVerification(email);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ error: "Thiếu email hoặc OTP" });
      return;
    }

    const result = await userService.verifyEmail(email, otp);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Thiếu ID người dùng" });
      return;
    }
    const result = await userService.deleteUser(id);
    res.json(result);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};
