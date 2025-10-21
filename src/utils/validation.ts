// src/utils/validation.ts
export const validation = {
  // Validate email format
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Validate phone format (Vietnam)
  validatePhone: (phone: string): boolean => {
    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    return phoneRegex.test(phone);
  },

  // Validate password strength
  validatePassword: (
    password: string
  ): { isValid: boolean; message?: string } => {
    if (password.length < 6) {
      return { isValid: false, message: "Mật khẩu phải có ít nhất 6 ký tự" };
    }
    if (password.length > 50) {
      return { isValid: false, message: "Mật khẩu không được quá 50 ký tự" };
    }
    if (!/(?=.*[a-zA-Z])/.test(password)) {
      return { isValid: false, message: "Mật khẩu phải có ít nhất 1 chữ cái" };
    }
    if (!/(?=.*\d)/.test(password)) {
      return { isValid: false, message: "Mật khẩu phải có ít nhất 1 số" };
    }
    return { isValid: true };
  },

  // Validate full name
  validateFullName: (
    fullName: string
  ): { isValid: boolean; message?: string } => {
    if (!fullName || fullName.trim().length < 2) {
      return { isValid: false, message: "Họ tên phải có ít nhất 2 ký tự" };
    }
    if (fullName.trim().length > 100) {
      return { isValid: false, message: "Họ tên không được quá 100 ký tự" };
    }
    if (
      !/^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠưăâêôơ\s]+$/.test(
        fullName
      )
    ) {
      return {
        isValid: false,
        message: "Họ tên chỉ được chứa chữ cái và khoảng trắng",
      };
    }
    return { isValid: true };
  },

  // Validate terms agreement
  validateTermsAgreement: (
    agreed: boolean
  ): { isValid: boolean; message?: string } => {
    if (!agreed) {
      return {
        isValid: false,
        message: "Bạn phải đồng ý với điều khoản sử dụng",
      };
    }
    return { isValid: true };
  },

  // Validate OTP format
  validateOTP: (otp: string): { isValid: boolean; message?: string } => {
    if (!otp || otp.length !== 6) {
      return { isValid: false, message: "Mã OTP phải có 6 chữ số" };
    }
    if (!/^\d{6}$/.test(otp)) {
      return { isValid: false, message: "Mã OTP chỉ được chứa số" };
    }
    return { isValid: true };
  },

  // Validate citizen ID
  validateCitizenId: (
    citizenId: string
  ): { isValid: boolean; message?: string } => {
    if (!citizenId) return { isValid: true }; // Optional field
    if (citizenId.length !== 12) {
      return { isValid: false, message: "CCCD/CMND phải có 12 chữ số" };
    }
    if (!/^\d{12}$/.test(citizenId)) {
      return { isValid: false, message: "CCCD/CMND chỉ được chứa số" };
    }
    return { isValid: true };
  },

  // Validate date of birth
  validateDateOfBirth: (
    dateOfBirth: string
  ): { isValid: boolean; message?: string } => {
    if (!dateOfBirth) return { isValid: true }; // Optional field
    const date = new Date(dateOfBirth);
    const now = new Date();
    const age = now.getFullYear() - date.getFullYear();

    if (isNaN(date.getTime())) {
      return { isValid: false, message: "Ngày sinh không hợp lệ" };
    }
    if (age < 16) {
      return { isValid: false, message: "Bạn phải ít nhất 16 tuổi" };
    }
    if (age > 120) {
      return { isValid: false, message: "Ngày sinh không hợp lệ" };
    }
    return { isValid: true };
  },
};
