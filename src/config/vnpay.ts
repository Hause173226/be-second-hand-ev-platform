export const VNPayConfig = {
    // TMN Code mẫu cho sandbox - cần thay bằng TMN Code thật từ VNPay
    vnp_TmnCode: "UY28ABIO",
    vnp_HashSecret: "6QUB93K3PHYMOHMLD6BRXZFCVTBMXHGQ",
    vnp_Url: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    vnp_ApiUrl: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    // Sử dụng domain thật thay vì localhost
    vnp_ReturnUrl: "http://localhost:8081/api/payment/vnpay-return",
    // Thêm IPN URL
    vnp_IpnUrl: "http://localhost:8081/api/payment/vnpay-ipn",
  };

  