import { RequestHandler } from "express";
import Listing from "../models/Listing";

/**
 * NEW: Admin list đa trạng thái + keyword + phân trang
 * GET /api/admin/listings?status=PendingReview|Published|Rejected&keyword=&page=&limit=
 */
export const adminList: RequestHandler = async (req, res, next) => {
  try {
    const {
      status = "PendingReview",
      keyword = "",
      page = "1",
      limit = "20",
    } = req.query as {
      status?: string;
      keyword?: string;
      page?: string;
      limit?: string;
    };

    // Chỉ cho 3 trạng thái dùng trong UI hiện tại
    const ALLOWED = ["PendingReview", "Published", "Rejected"];
    if (!ALLOWED.includes(String(status))) {
      res.status(400).json({ message: "status không hợp lệ" });
      return;
    }

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { status };

    // Tìm kiếm nhanh theo hãng/model/notes/thành phố/quận + bắt năm nếu có
    const kw = String(keyword || "").trim();
    if (kw) {
      const words = kw.split(/\s+/).filter(Boolean);
      const yearMatch = kw.match(/\b(19|20)\d{2}\b/);
      const yearFromKeyword = yearMatch ? parseInt(yearMatch[0], 10) : null;

      const or: any[] = [
        { make: { $regex: kw, $options: "i" } },
        { model: { $regex: kw, $options: "i" } },
        { notes: { $regex: kw, $options: "i" } },
        { "location.city": { $regex: kw, $options: "i" } },
        { "location.district": { $regex: kw, $options: "i" } },
      ];

      if (words.length >= 2) {
        const possibleMake = words[0];
        const possibleModel = words.slice(1).join(" ").replace(/\b(19|20)\d{2}\b/, "").trim();
        if (possibleModel) {
          or.push({
            $and: [
              { make: { $regex: possibleMake, $options: "i" } },
              { model: { $regex: possibleModel, $options: "i" } },
            ],
          });
        }
      }

      if (yearFromKeyword) {
        const kwNoYear = kw.replace(/\b(19|20)\d{2}\b/, "").trim();
        or.push({
          $and: [
            { year: yearFromKeyword },
            {
              $or: [
                { make: { $regex: kwNoYear, $options: "i" } },
                { model: { $regex: kwNoYear, $options: "i" } },
              ],
            },
          ],
        });
      }

      filter.$or = or;
    }

    const [list, totalCount] = await Promise.all([
      Listing.find(filter)
        .populate("sellerId", "fullName phone email avatar")
        .sort({ createdAt: -1 }) // mới nhất trước
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Listing.countDocuments(filter),
    ]);

    res.json({
      listings: list,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
        hasNextPage: pageNum * limitNum < totalCount,
        hasPrevPage: pageNum > 1,
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * LEGACY: hàng chờ duyệt cũ (giữ lại để tương thích)
 * GET /api/admin/listings/pending
 */
export const pendingQueue: RequestHandler = async (_req, res, next) => {
  try {
    const list = await Listing.find({ status: "PendingReview" })
      .populate("sellerId", "fullName phone avatar email")
      .sort({ createdAt: -1 }); // mới nhất trước
    res.json(list);
  } catch (err) {
    next(err);
  }
};

export const approveListing: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: "Listing không tồn tại" });
      return;
    }
    if (listing.status !== "PendingReview") {
      res.status(409).json({ message: "Chỉ duyệt khi PendingReview" });
      return;
    }

    listing.status = "Published";
    listing.set("rejectReason", undefined);
    listing.set("publishedAt", new Date());
    await listing.save();

    // TODO: gửi notification/email seller
    res.json({ message: "Đã duyệt", listing });
  } catch (err) {
    next(err);
  }
};

export const rejectListing: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: "Listing không tồn tại" });
      return;
    }
    if (listing.status !== "PendingReview") {
      res.status(409).json({ message: "Chỉ từ chối khi PendingReview" });
      return;
    }

    listing.status = "Rejected";
    listing.set("rejectReason", (reason || "Không đạt tiêu chuẩn").slice(0, 500));
    await listing.save();

    // TODO: gửi notification/email
    res.json({ message: "Đã từ chối", listing });
  } catch (err) {
    next(err);
  }
};
