import crypto from "crypto";
import moment from "moment";
import querystring from "qs";
import { Request } from "express";
import { Booking } from "../models/Booking";
import { PaymentHistory } from "../models/Payment";
import { Trip } from "../models/Trip"; // THÊM import này
import { VNPayConfig } from "../config/vnpay";
import { SeatBookingService } from "./seatBookingService";

// Helper function để sort object
function sortObject(obj: any) {
  let sorted: any = {};
  let str = [];
  let key;
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Sửa dòng này
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

export const createVNPayOrder = async (bookingId: string, req: Request) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error("Booking not found");

  // Kiểm tra trạng thái booking
  if (booking.bookingStatus === "cancelled") {
    throw new Error(
      "Cannot process payment for cancelled booking. Please create a new booking."
    );
  }

  if (booking.paymentStatus === "paid") {
    throw new Error("This booking has already been paid.");
  }

  // Kiểm tra thêm: booking quá hạn
  const now = new Date();
  const bookingTime = new Date(booking.createdAt);
  const hoursDiff = (now.getTime() - bookingTime.getTime()) / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    // Booking quá 24h
    booking.bookingStatus = "cancelled";
    await booking.save();
    throw new Error("Booking has expired. Please create a new booking.");
  }

  process.env.TZ = "Asia/Ho_Chi_Minh";

  let date = new Date();
  let createDate = moment(date).format("YYYYMMDDHHmmss");

  let ipAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection as any).socket?.remoteAddress;

  let orderId = moment(date).format("DDHHmmss");
  let amount = booking.totalAmount;
  let bankCode = "";

  let locale = "vn";
  let currCode = "VND";

  let vnp_Params: any = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = VNPayConfig.vnp_TmnCode;
  vnp_Params["vnp_Locale"] = locale;
  vnp_Params["vnp_CurrCode"] = currCode;
  vnp_Params["vnp_TxnRef"] = orderId;
  vnp_Params[
    "vnp_OrderInfo"
  ] = `Thanh toan cho ma GD: ${orderId} - Booking: ${booking.bookingCode}`;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = amount * 100;
  vnp_Params["vnp_ReturnUrl"] = VNPayConfig.vnp_ReturnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;

  if (bankCode !== null && bankCode !== "") {
    vnp_Params["vnp_BankCode"] = bankCode;
  }

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  let vnpUrl =
    VNPayConfig.vnp_Url +
    "?" +
    querystring.stringify(vnp_Params, { encode: false });

  // Lưu thông tin vào booking
  booking.paymentMethod = "online";
  booking.bookingStatus = "pending";
  booking.paymentStatus = "unpaid";
  await booking.save();

  // Lưu vào payment history
  const paymentHistory = new PaymentHistory({
    booking: booking._id,
    amount: booking.totalAmount,
    paymentMethod: "online",
    paymentStatus: "pending",
    transactionId: orderId,
    notes: `VNPay payment created for booking ${booking.bookingCode}`,
  });
  await paymentHistory.save();

  return {
    paymentUrl: vnpUrl,
    orderId: orderId,
  };
};

export const handleVNPayReturn = async (vnp_Params: any) => {
  let secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash === signed) {
    let orderId = vnp_Params["vnp_TxnRef"];
    let responseCode = vnp_Params["vnp_ResponseCode"];

    const paymentHistory = await PaymentHistory.findOne({
      transactionId: orderId,
    });

    if (paymentHistory) {
      const booking = await Booking.findById(paymentHistory.booking);

      if (responseCode === "00") {
        // Thanh toán thành công
        if (booking) {
          booking.paymentStatus = "paid";
          booking.bookingStatus = "confirmed";
          booking.paymentDate = new Date();
          await booking.save();

          // THÊM: Confirm ghế từ selected → booked
          try {
            await SeatBookingService.confirmSeatBooking(
              booking.trip.toString(),
              booking.seatNumbers,
              booking._id.toString()
            );
          } catch (seatError) {
            console.error("Error confirming seats:", seatError);
          }

          // Giảm số ghế còn lại trong Trip
          try {
            await Trip.findByIdAndUpdate(booking.trip, {
              $inc: { availableSeats: -booking.seatNumbers.length },
            });
          } catch (tripError) {
            console.error("Error updating available seats:", tripError);
          }
        }

        paymentHistory.paymentStatus = "success";
        paymentHistory.gatewayResponse = vnp_Params;
        await paymentHistory.save();

        return { success: true, responseCode, orderId };
      } else {
        // Thanh toán thất bại
        if (booking) {
          booking.paymentStatus = "failed";
          booking.bookingStatus = "cancelled";
          await booking.save();

          // THÊM: Release ghế về available
          try {
            await SeatBookingService.releaseSeatSelection(
              booking.trip.toString(),
              booking.seatNumbers
            );
            console.log(
              "Seats released for failed payment:",
              booking.bookingCode
            );
          } catch (releaseError) {
            console.error("Error releasing seats:", releaseError);
          }
        }

        paymentHistory.paymentStatus = "failed";
        paymentHistory.gatewayResponse = vnp_Params;
        await paymentHistory.save();

        return { success: false, responseCode, orderId };
      }
    }

    return { success: false, responseCode: "01", orderId };
  } else {
    return {
      success: false,
      responseCode: "97",
      orderId: vnp_Params["vnp_TxnRef"],
    };
  }
};

export const handleVNPayCallback = async (vnp_Params: any) => {
  let secureHash = vnp_Params["vnp_SecureHash"];
  let orderId = vnp_Params["vnp_TxnRef"];
  let rspCode = vnp_Params["vnp_ResponseCode"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPayConfig.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  const paymentHistory = await PaymentHistory.findOne({
    transactionId: orderId,
  });

  if (secureHash === signed) {
    if (paymentHistory) {
      let checkAmount =
        vnp_Params["vnp_Amount"] / 100 === paymentHistory.amount;

      if (checkAmount) {
        if (paymentHistory.paymentStatus === "pending") {
          const booking = await Booking.findById(paymentHistory.booking);

          if (rspCode === "00") {
            // Thanh toán thành công
            if (booking) {
              booking.paymentStatus = "paid";
              booking.bookingStatus = "confirmed";
              booking.paymentDate = new Date();
              await booking.save();

              // THÊM: Confirm ghế từ selected → booked
              try {
                await SeatBookingService.confirmSeatBooking(
                  booking.trip.toString(),
                  booking.seatNumbers,
                  booking._id.toString()
                );
              } catch (seatError) {
                console.error("[Callback] Error confirming seats:", seatError);
              }

              // Giảm số ghế còn lại trong Trip
              try {
                await Trip.findByIdAndUpdate(booking.trip, {
                  $inc: { availableSeats: -booking.seatNumbers.length },
                });
              } catch (tripError) {
                console.error(
                  "[Callback] Error updating available seats:",
                  tripError
                );
              }
            }

            paymentHistory.paymentStatus = "success";
            paymentHistory.gatewayResponse = vnp_Params;
            await paymentHistory.save();

            return { RspCode: "00", Message: "Success" };
          } else {
            // Thanh toán thất bại
            if (booking) {
              booking.paymentStatus = "failed";
              booking.bookingStatus = "cancelled";
              await booking.save();

              // THÊM: Release ghế về available
              try {
                await SeatBookingService.releaseSeatSelection(
                  booking.trip.toString(),
                  booking.seatNumbers
                );
                console.log(
                  "[Callback] Seats released for failed payment:",
                  booking.bookingCode
                );
              } catch (releaseError) {
                console.error(
                  "[Callback] Error releasing seats:",
                  releaseError
                );
              }
            }

            paymentHistory.paymentStatus = "failed";
            paymentHistory.gatewayResponse = vnp_Params;
            await paymentHistory.save();

            return { RspCode: "00", Message: "Success" };
          }
        } else {
          return {
            RspCode: "02",
            Message: "This order has been updated to the payment status",
          };
        }
      } else {
        return { RspCode: "04", Message: "Amount invalid" };
      }
    } else {
      return { RspCode: "01", Message: "Order not found" };
    }
  } else {
    return { RspCode: "97", Message: "Checksum failed" };
  }
};

export const getBookingDetailsByOrderId = async (orderId: string) => {
  try {
    // Validate orderId
    if (!orderId || orderId.trim() === "") {
      throw new Error("Order ID is required");
    }

    // Tìm payment history theo transaction ID
    const paymentHistory = await PaymentHistory.findOne({
      transactionId: orderId.trim(),
    });

    if (!paymentHistory) {
      throw new Error("Order not found");
    }

    // Lấy thông tin booking với populate
    const booking = await Booking.findById(paymentHistory.booking)
      .populate({
        path: "customer",
        select: "fullName email phone", // Chỉ lấy những field cần thiết
      })
      .populate({
        path: "trip",
        populate: [
          { path: "route", select: "name code" },
          { path: "bus", select: "licensePlate busType seatCount" },
        ],
      })
      .populate("pickupStation", "name address")
      .populate("dropoffStation", "name address");

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Thêm thông tin payment history vào response
    return {
      ...booking.toObject(),
      paymentHistory: {
        transactionId: paymentHistory.transactionId,
        paymentStatus: paymentHistory.paymentStatus,
        processedAt: paymentHistory.processedAt,
        gatewayResponse: paymentHistory.gatewayResponse,
      },
    };
  } catch (error: any) {
    console.error("Service - Get booking details error:", error);
    throw new Error(error.message || "Failed to get booking details");
  }
};
