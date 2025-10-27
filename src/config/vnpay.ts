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
};
