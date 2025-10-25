// src/services/ssoService.ts
import { User } from "../models/User";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "your_refresh_token_secret";
const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "7d";

export const ssoService = {
  // Google OAuth callback
  handleGoogleCallback: async (profile: any) => {
    try {
      const { id, emails, name, photos } = profile;

      // Tìm user theo Google ID hoặc email
      let user = await User.findOne({
        $or: [{ googleId: id }, { email: emails[0].value }],
      });

      if (user) {
        // User đã tồn tại - cập nhật Google ID nếu chưa có
        if (!user.googleId) {
          user.googleId = id;
          user.isActive = true; // Auto activate cho SSO
          await user.save();
        }
      } else {
        // Tạo user mới
        user = await User.create({
          fullName: name.givenName + " " + name.familyName,
          email: emails[0].value,
          googleId: id,
          avatar: photos[0].value,
          role: "user",
          isActive: true, // Auto activate cho SSO
        });
      }

      // Tạo tokens
      const { accessToken, refreshToken } = await ssoService.generateTokens(
        user
      );

      return {
        user: user.toObject(),
        accessToken,
        refreshToken,
        message: "Đăng nhập Google thành công",
      };
    } catch (error) {
      console.error("Google OAuth Error:", error);
      throw new Error("Lỗi đăng nhập Google");
    }
  },

  // Facebook OAuth callback
  handleFacebookCallback: async (profile: any) => {
    try {
      const { id, emails, name, photos } = profile;

      // Tìm user theo Facebook ID hoặc email
      let user = await User.findOne({
        $or: [{ facebookId: id }, { email: emails[0].value }],
      });

      if (user) {
        // User đã tồn tại - cập nhật Facebook ID nếu chưa có
        if (!user.facebookId) {
          user.facebookId = id;
          user.isActive = true; // Auto activate cho SSO
          await user.save();
        }
      } else {
        // Tạo user mới
        user = await User.create({
          fullName: name.givenName + " " + name.familyName,
          email: emails[0].value,
          facebookId: id,
          avatar: photos[0].value,
          role: "user",
          isActive: true, // Auto activate cho SSO
        });
      }

      // Tạo tokens
      const { accessToken, refreshToken } = await ssoService.generateTokens(
        user
      );

      return {
        user: user.toObject(),
        accessToken,
        refreshToken,
        message: "Đăng nhập Facebook thành công",
      };
    } catch (error) {
      console.error("Facebook OAuth Error:", error);
      throw new Error("Lỗi đăng nhập Facebook");
    }
  },

  // Tạo JWT tokens
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
};
