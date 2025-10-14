// src/utils/errorHandler.ts
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorMessages = {
  // User errors
  USER_NOT_FOUND: "Không tìm thấy người dùng",
  USER_ALREADY_EXISTS: "Người dùng đã tồn tại",
  EMAIL_ALREADY_EXISTS: "Email đã tồn tại. Bạn có muốn đăng nhập không?",
  PHONE_ALREADY_EXISTS:
    "Số điện thoại đã tồn tại. Bạn có muốn đăng nhập không?",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng",
  INVALID_PHONE: "Số điện thoại không tồn tại hoặc chưa được kích hoạt",

  // OTP errors
  INVALID_OTP: "Mã OTP không đúng",
  EXPIRED_OTP: "Mã OTP đã hết hạn. Vui lòng gửi lại mã mới",
  OTP_NOT_FOUND: "Không tìm thấy mã OTP",
  OTP_SEND_FAILED: "Không thể gửi mã OTP. Vui lòng thử lại",

  // Token errors
  INVALID_TOKEN: "Token không hợp lệ",
  EXPIRED_TOKEN: "Token đã hết hạn",
  TOKEN_NOT_FOUND: "Không tìm thấy token",

  // Validation errors
  INVALID_EMAIL_FORMAT: "Email không đúng định dạng",
  INVALID_PHONE_FORMAT: "Số điện thoại không đúng định dạng (VD: 0987654321)",
  WEAK_PASSWORD: "Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ cái và số",
  INVALID_FULLNAME: "Họ tên phải có ít nhất 2 ký tự và chỉ chứa chữ cái",
  TERMS_NOT_AGREED: "Bạn phải đồng ý với điều khoản sử dụng",

  // Server errors
  INTERNAL_SERVER_ERROR: "Lỗi server nội bộ",
  DATABASE_ERROR: "Lỗi cơ sở dữ liệu",
  EMAIL_SERVICE_ERROR: "Lỗi dịch vụ email",
  SMS_SERVICE_ERROR: "Lỗi dịch vụ SMS",

  // SSO errors
  SSO_AUTH_FAILED: "Xác thực SSO thất bại",
  SSO_PROFILE_INVALID: "Thông tin profile SSO không hợp lệ",
};

export const createError = (message: string, statusCode: number = 500) => {
  return new AppError(message, statusCode);
};

export const handleAsyncError = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
