export const VNPayConfig = {
  vnp_TmnCode: "UY28ABIO",
  vnp_HashSecret: "L5CM7EQC41E7JFZWJIRP7XKGRDFTIIMP",
  vnp_Url: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  vnp_ApiUrl: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",

  // Booking payment
  vnp_ReturnUrl: "http://localhost:8081/api/payment/vnpay-return",
  vnp_IpnUrl: "http://localhost:8081/api/payment/vnpay-ipn",

  // Wallet payment
  vnp_WalletReturnUrl: "http://localhost:8081/api/payment/wallet/vnpay-return",
  
  // Deposit payment (đặt cọc - nạp vào ví người dùng)
  vnp_DepositReturnUrl: "http://localhost:8081/api/payment/deposit/vnpay-return",
  
  // Remaining amount payment (số tiền còn lại - chuyển vào ví hệ thống)
  vnp_RemainingReturnUrl: "http://localhost:8081/api/payment/remaining/vnpay-return",
  
  // Full payment (mua full - chuyển vào ví hệ thống)
  vnp_FullPaymentReturnUrl: "http://localhost:8081/api/payment/full/vnpay-return",
};
