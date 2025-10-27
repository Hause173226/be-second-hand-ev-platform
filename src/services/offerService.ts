import Offer from "../models/Offer";
import Listing from "../models/Listing";
import { User } from "../models/User";

export class OfferService {
  // Tạo đề nghị mới
  async createOffer(data: {
    listingId: string;
    buyerId: string;
    offerPrice: number;
    message?: string;
  }) {
    // Kiểm tra listing tồn tại
    const listing = await Listing.findById(data.listingId);
    if (!listing) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    if (listing.status !== "Published") {
      throw new Error("Sản phẩm chưa được duyệt hoặc đã bị gỡ");
    }

    // Không cho phép tự đề nghị sản phẩm của mình
    if (listing.sellerId.toString() === data.buyerId) {
      throw new Error("Không thể đề nghị mua sản phẩm của chính mình");
    }

    // Kiểm tra giá đề nghị hợp lý (ví dụ: không quá thấp)
    if (data.offerPrice < listing.priceListed * 0.5) {
      throw new Error("Giá đề nghị quá thấp (tối thiểu 50% giá niêm yết)");
    }

    // Tạo offer
    const offer = await Offer.create({
      listingId: data.listingId,
      buyerId: data.buyerId,
      sellerId: listing.sellerId,
      offerPrice: data.offerPrice,
      message: data.message,
      status: "pending",
      createdAt: new Date()
    });

    // Populate thông tin
    await offer.populate("buyerId", "fullName email phone avatar");
    await offer.populate("sellerId", "fullName email phone");
    await offer.populate("listingId", "make model year priceListed photos");

    // TODO: Gửi thông báo cho seller
    // await notificationService.sendOfferNotification(listing.sellerId, offer);

    return offer;
  }

  // Phản hồi đề nghị (accept/reject/counter)
  async respondToOffer(
    offerId: string,
    sellerId: string,
    action: "accepted" | "rejected" | "countered",
    counterPrice?: number,
    message?: string
  ) {
    const offer = await Offer.findById(offerId)
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .populate("listingId", "make model year priceListed");

    if (!offer) {
      throw new Error("Không tìm thấy đề nghị");
    }

    // Kiểm tra quyền
    if (offer.sellerId._id.toString() !== sellerId) {
      throw new Error("Bạn không có quyền phản hồi đề nghị này");
    }

    if (offer.status !== "pending") {
      throw new Error("Đề nghị đã được phản hồi trước đó");
    }

    // Cập nhật trạng thái
    offer.status = action;
    // offer.respondedAt = new Date(); // Không có trong interface

    if (action === "countered") {
      if (!counterPrice) {
        throw new Error("Cần cung cấp giá phản đề nghị");
      }
      // offer.counterPrice = counterPrice; // Không có trong interface
      // offer.counterMessage = message; // Không có trong interface
      offer.message = message || offer.message; // Lưu vào message thay thế
    }

    if (action === "rejected" && message) {
      // offer.rejectReason = message; // Không có trong interface
      offer.message = message; // Lưu vào message thay thế
    }

    await offer.save();

    // TODO: Gửi thông báo cho buyer
    // await notificationService.sendOfferResponseNotification(offer.buyerId, offer);

    return offer;
  }

  // Buyer chấp nhận giá phản đề nghị
  async acceptCounterOffer(offerId: string, buyerId: string) {
    const offer = await Offer.findById(offerId)
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .populate("listingId", "make model year priceListed");

    if (!offer) {
      throw new Error("Không tìm thấy đề nghị");
    }

    // Kiểm tra quyền
    if (offer.buyerId._id.toString() !== buyerId) {
      throw new Error("Bạn không có quyền chấp nhận đề nghị này");
    }

    if (offer.status !== "countered") {
      throw new Error("Không có giá phản đề nghị để chấp nhận");
    }

    // Chấp nhận counter offer
    offer.status = "accepted";
    // offer.acceptedAt = new Date(); // Không có trong interface
    // offer.finalPrice = offer.counterPrice; // Không có trong interface

    await offer.save();

    // TODO: Tạo appointment tự động hoặc thông báo tạo appointment
    // await appointmentService.createFromOffer(offer);

    return offer;
  }

  // Hủy đề nghị
  async cancelOffer(offerId: string, userId: string) {
    const offer = await Offer.findById(offerId);

    if (!offer) {
      throw new Error("Không tìm thấy đề nghị");
    }

    // Chỉ buyer mới có thể hủy đề nghị của mình
    if (offer.buyerId.toString() !== userId) {
      throw new Error("Bạn không có quyền hủy đề nghị này");
    }

    if (offer.status !== "pending" && offer.status !== "countered") {
      throw new Error("Không thể hủy đề nghị đã được chấp nhận hoặc từ chối");
    }

    offer.status = "expired"; // Sử dụng "expired" thay vì "cancelled"
    await offer.save();

    return offer;
  }

  // Lấy danh sách đề nghị của buyer
  async getBuyerOffers(buyerId: string, status?: string) {
    const query: any = { buyerId };
    if (status) {
      query.status = status;
    }

    const offers = await Offer.find(query)
      .populate("sellerId", "fullName email phone avatar")
      .populate("listingId", "make model year priceListed photos status")
      .sort({ createdAt: -1 });

    return offers;
  }

  // Lấy danh sách đề nghị cho seller
  async getSellerOffers(sellerId: string, status?: string) {
    const query: any = { sellerId };
    if (status) {
      query.status = status;
    }

    const offers = await Offer.find(query)
      .populate("buyerId", "fullName email phone avatar")
      .populate("listingId", "make model year priceListed photos status")
      .sort({ createdAt: -1 });

    return offers;
  }

  // Lấy đề nghị cho một listing cụ thể
  async getListingOffers(listingId: string, sellerId: string) {
    // Kiểm tra quyền
    const listing = await Listing.findById(listingId);
    if (!listing) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    if (listing.sellerId.toString() !== sellerId) {
      throw new Error("Bạn không có quyền xem đề nghị cho sản phẩm này");
    }

    const offers = await Offer.find({ listingId })
      .populate("buyerId", "fullName email phone avatar")
      .sort({ createdAt: -1 });

    return offers;
  }

  // Lấy chi tiết đề nghị
  async getOfferById(offerId: string, userId: string) {
    const offer = await Offer.findById(offerId)
      .populate("buyerId", "fullName email phone avatar")
      .populate("sellerId", "fullName email phone avatar")
      .populate("listingId", "make model year priceListed photos");

    if (!offer) {
      throw new Error("Không tìm thấy đề nghị");
    }

    // Kiểm tra quyền xem
    const isBuyer = offer.buyerId._id.toString() === userId;
    const isSeller = offer.sellerId._id.toString() === userId;

    if (!isBuyer && !isSeller) {
      throw new Error("Bạn không có quyền xem đề nghị này");
    }

    return offer;
  }

  // Lấy thống kê đề nghị
  async getOfferStats(userId: string, role: "buyer" | "seller") {
    const query = role === "buyer" ? { buyerId: userId } : { sellerId: userId };
    const offers = await Offer.find(query);

    const stats = {
      total: offers.length,
      pending: offers.filter(o => o.status === "pending").length,
      accepted: offers.filter(o => o.status === "accepted").length,
      rejected: offers.filter(o => o.status === "rejected").length,
      countered: offers.filter(o => o.status === "countered").length,
      expired: offers.filter(o => o.status === "expired").length // Thay "cancelled" thành "expired"
    };

    return stats;
  }

  // Lấy giá trung bình của các đề nghị cho một listing
  async getListingOfferStats(listingId: string) {
    const offers = await Offer.find({ 
      listingId,
      status: { $in: ["pending", "accepted", "countered"] }
    });

    if (offers.length === 0) {
      return {
        count: 0,
        averageOffer: 0,
        highestOffer: 0,
        lowestOffer: 0
      };
    }

    const offerPrices = offers.map(o => o.offeredPrice); // Sửa offerPrice thành offeredPrice
    const sum = offerPrices.reduce((a, b) => a + b, 0);

    return {
      count: offers.length,
      averageOffer: Math.round(sum / offers.length),
      highestOffer: Math.max(...offerPrices),
      lowestOffer: Math.min(...offerPrices)
    };
  }
}

export default new OfferService();

