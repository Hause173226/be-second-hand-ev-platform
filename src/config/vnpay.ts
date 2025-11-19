// Base URL cho VNPay callbacks
// Lưu ý: VNPay sandbox có thể không chấp nhận localhost
// Giải pháp:
// 1. Dùng ngrok: npx ngrok http 8081 → copy URL vào VNPAY_BASE_URL
// 2. Hoặc dùng public domain/deployment URL
// 3. Hoặc đăng ký Return URL trong VNPay merchant portal
const VNPAY_BASE_URL = process.env.VNPAY_BASE_URL || "http://localhost:8081";

export const VNPayConfig = {
  vnp_TmnCode: process.env.VNPAY_TMN_CODE || "UY28ABIO",
  vnp_HashSecret:
    process.env.VNPAY_HASH_SECRET || "HCE60T7GQYDZUJJ216XKP1Z8KHZN69PX",
  vnp_Url: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  vnp_ApiUrl: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",

  // Booking payment
  vnp_ReturnUrl: `${VNPAY_BASE_URL}/api/payment/vnpay-return`,
  vnp_IpnUrl: `${VNPAY_BASE_URL}/api/payment/vnpay-ipn`,

  // Wallet payment
  vnp_WalletReturnUrl: `${VNPAY_BASE_URL}/api/payment/wallet/vnpay-return`,

  // Deposit payment (đặt cọc - nạp vào ví người dùng)
  vnp_DepositReturnUrl: `${VNPAY_BASE_URL}/api/payment/deposit/vnpay-return`,

  // Remaining amount payment (số tiền còn lại - chuyển vào ví hệ thống)
  vnp_RemainingReturnUrl: `${VNPAY_BASE_URL}/api/payment/remaining/vnpay-return`,

  // Full payment (mua full - chuyển vào ví hệ thống)
  vnp_FullPaymentReturnUrl: `${VNPAY_BASE_URL}/api/payment/full/vnpay-return`,

  // Appointment payment IPN URLs (cho callbacks từ VNPay)
  vnp_AppointmentDepositIpnUrl: `${VNPAY_BASE_URL}/api/payment/appointment-deposit-callback`,
  vnp_AppointmentFullPaymentIpnUrl: `${VNPAY_BASE_URL}/api/payment/appointment-full-payment-callback`,
};
