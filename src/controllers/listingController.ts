// src/controllers/listingController.ts
import { RequestHandler } from "express";
import Listing from "../models/Listing";
import { moderationService } from "../services/moderationService";
import { SearchHistory } from "../models/SearchHistory";

// Heuristic only (theo yêu cầu tạm thời không dùng Gemini)
import { suggestHeuristic } from "../services/priceAI.heuristic";
import { PriceAIInput } from "../services/priceAI.types";

const isOwner = (userId?: string, sellerId?: any) =>
  userId && sellerId && sellerId.toString() === userId.toString();

const parseLocation = (raw: unknown) => {
  try {
    if (typeof raw === "string") return JSON.parse(raw);
    return raw;
  } catch {
    return undefined;
  }
};

const toBool = (v: unknown) =>
  typeof v === "string" ? v === "true" : Boolean(v);

/**
 * Tạo listing (status = Draft)
 * (Phần 15) Parse & validate priceListed + tradeMethod
 */
export const createListing: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = (req as any).user?._id;
    if (!sellerId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (!Array.isArray(files) || files.length < 3) {
      res.status(400).json({ message: "Cần tối thiểu 3 ảnh" });
      return;
    }
    const photos = files.map((f) => ({
      url: `/uploads/${f.filename}`,
      kind: "photo" as const,
    }));

    const {
      type,
      make,
      model,
      year,
      batteryCapacityKWh,
      mileageKm,
      chargeCycles,
      condition,
      priceListed,     // ⬅️ phần 15
      tradeMethod,     // ⬅️ phần 15
      sellerConfirm,
      location,
    } = req.body;

    const locObj = parseLocation(location);
    const confirmed = toBool(sellerConfirm);

    // (15) ép & validate priceListed
    const priceListedNum =
      typeof priceListed === "string" ? Number(priceListed) : Number(priceListed);
    if (Number.isNaN(priceListedNum) || priceListedNum < 0) {
      res.status(400).json({ message: "priceListed không hợp lệ" });
      return;
    }

    // (15) validate tradeMethod
    const ALLOWED_TRADE: Array<"meet" | "ship" | "consignment"> = [
      "meet",
      "ship",
      "consignment",
    ];
    const trade =
      typeof tradeMethod === "string" && ALLOWED_TRADE.includes(tradeMethod as any)
        ? (tradeMethod as any)
        : "meet";

    const listing = await Listing.create({
      sellerId,
      type,
      make,
      model,
      year,
      batteryCapacityKWh,
      mileageKm,
      chargeCycles,
      condition,
      photos,
      // location đã bỏ lat/lng ở schema → để object đơn giản
      location: locObj,
      // (15)
      priceListed: priceListedNum,
      tradeMethod: trade,
      status: "Draft",
      notes: confirmed ? undefined : "Chưa xác nhận chính chủ",
    });

    res.status(201).json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * Cập nhật listing (chỉ khi Draft/Rejected)
 * (Phần 15) Cho phép sửa priceListed + tradeMethod
 */
export const updateListing: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as any).user?._id;
    const { id } = req.params;

    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: "Listing không tồn tại" });
      return;
    }
    if (!isOwner(userId, listing.sellerId)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (!["Draft", "Rejected"].includes(listing.status)) {
      res.status(409).json({ message: "Chỉ sửa khi Draft/Rejected" });
      return;
    }

    const allowed: Array<
      | "type"
      | "make"
      | "model"
      | "year"
      | "batteryCapacityKWh"
      | "mileageKm"
      | "chargeCycles"
      | "condition"
      | "priceListed"
      | "tradeMethod"
      | "location"
      | "notes"
      | "sellerConfirm"
    > = [
        "type",
        "make",
        "model",
        "year",
        "batteryCapacityKWh",
        "mileageKm",
        "chargeCycles",
        "condition",
        "priceListed",
        "tradeMethod",
        "location",
        "notes",
        "sellerConfirm",
      ];

    for (const k of allowed) {
      if (typeof (req.body as any)[k] === "undefined") continue;

      if (k === "location") {
        (listing as any).location = parseLocation(req.body.location);
        continue;
      }

      if (k === "sellerConfirm") {
        const confirmed = toBool((req.body as any).sellerConfirm);
        listing.notes = confirmed ? undefined : "Chưa xác nhận chính chủ";
        continue;
      }

      if (k === "priceListed") {
        const n =
          typeof (req.body as any).priceListed === "string"
            ? Number((req.body as any).priceListed)
            : Number((req.body as any).priceListed);
        if (Number.isNaN(n) || n < 0) {
          res.status(400).json({ message: "priceListed không hợp lệ" });
          return;
        }
        (listing as any).priceListed = n;
        continue;
      }

      if (k === "tradeMethod") {
        const ALLOWED_TRADE: Array<"meet" | "ship" | "consignment"> = [
          "meet",
          "ship",
          "consignment",
        ];
        const v = (req.body as any).tradeMethod;
        if (!ALLOWED_TRADE.includes(v)) {
          res.status(400).json({ message: "tradeMethod không hợp lệ" });
          return;
        }
        (listing as any).tradeMethod = v;
        continue;
      }

      (listing as any)[k] = (req.body as any)[k];
    }

    await listing.save();
    res.json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * Submit listing để duyệt (Draft/Rejected -> PendingReview)
 * (Tuỳ chọn) bắt buộc có tradeMethod trước khi submit
 */
export const submitListing: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as any).user?._id;
    const { id } = req.params;

    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: "Listing không tồn tại" });
      return;
    }
    if (!isOwner(userId, listing.sellerId)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (!["Draft", "Rejected"].includes(listing.status)) {
      res.status(409).json({ message: "Chỉ submit khi Draft/Rejected" });
      return;
    }

    // validate dữ liệu bắt buộc tối thiểu
    if (!listing.photos || listing.photos.length < 3) {
      res.status(400).json({ message: "Cần tối thiểu 3 ảnh trước khi submit" });
      return;
    }
    if (
      (listing.priceListed === undefined || listing.priceListed === null) ||
      !listing.location?.city ||
      !listing.location?.district ||
      !listing.location?.address
    ) {
      res.status(400).json({ message: "Thiếu dữ liệu bắt buộc (giá, vị trí...)" });
      return;
    }
    // (15) nếu muốn bắt buộc tradeMethod:
    if (!listing.tradeMethod) {
      res.status(400).json({ message: "Thiếu hình thức giao dịch (tradeMethod)" });
      return;
    }

    // auto moderation
    const mod = await moderationService.scanListing(listing);
    if (!mod.ok) {
      res
        .status(400)
        .json({ message: "Auto moderation failed", reasons: mod.reasons });
      return;
    }

    listing.status = "PendingReview";
    listing.rejectReason = undefined;
    await listing.save();

    res.json({ message: "Đã submit, chờ duyệt", listing });
  } catch (err) {
    next(err);
  }
};

/**
 * Danh sách listing của user hiện tại
 */
export const myListings: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = (req as any).user?._id;
    const list = await Listing.find({ sellerId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    next(err);
  }
};

/* ----------------------- PRICE SUGGEST (heuristic only) ----------------------- */

/**
 * Gợi ý giá (tạm thời chỉ dùng heuristic, không gọi Gemini)
 * Body: { type, year, mileageKm, batteryCapacityKWh, condition, make, model }
 */
export const priceSuggestionAI: RequestHandler = async (req, res, next) => {
  try {
    const payload = req.body as PriceAIInput;

    // Kiểm tra tối thiểu
    if (!payload?.make || !payload?.model || !payload?.year) {
      res.status(400).json({ message: "Thiếu make/model/year" });
      return;
    }

    // Chỉ chạy heuristic
    const h = suggestHeuristic(payload);
    res.setHeader("X-Provider-Used", "heuristic");
    res.json({ provider: "heuristic", ...h });
  } catch (err) {
    next(err);
  }
};

/* ----------------------- SEARCH & FILTER API ----------------------- */


export const searchListings: RequestHandler = async (req, res, next) => {
  try {
    const {
      keyword,
      make,
      model,
      year,
      batteryCapacityKWh,
      mileageKm,
      minPrice,
      maxPrice,
      city,
      district,
      condition,
      sortBy = "newest",
      page = "1",
      limit = "12"
    } = req.query;

    // Build filter object
    const filter: any = {
      status: "Published" // Chỉ lấy sản phẩm đã được duyệt
    };

    // Text search với keyword
    if (keyword) {
      filter.$or = [
        { make: { $regex: keyword, $options: "i" } },
        { model: { $regex: keyword, $options: "i" } },
        { notes: { $regex: keyword, $options: "i" } }
      ];
    }

    // Filter theo các trường cụ thể
    if (make) filter.make = { $regex: make, $options: "i" };
    if (model) filter.model = { $regex: model, $options: "i" };
    if (year) filter.year = parseInt(year as string);
    if (batteryCapacityKWh) filter.batteryCapacityKWh = parseInt(batteryCapacityKWh as string);
    if (mileageKm) filter.mileageKm = { $lte: parseInt(mileageKm as string) };
    if (condition) filter.condition = condition;

    // Price range filter
    if (minPrice || maxPrice) {
      filter.priceListed = {};
      if (minPrice) filter.priceListed.$gte = parseInt(minPrice as string);
      if (maxPrice) filter.priceListed.$lte = parseInt(maxPrice as string);
    }

    // Location filter
    if (city || district) {
      filter["location.city"] = city ? { $regex: city, $options: "i" } : undefined;
      filter["location.district"] = district ? { $regex: district, $options: "i" } : undefined;

      // Remove undefined values
      Object.keys(filter).forEach(key => {
        if (filter[key] === undefined) delete filter[key];
      });
    }

    // Build sort object
    let sort: any = {};
    switch (sortBy) {
      case "newest":
        sort = { publishedAt: -1, createdAt: -1 };
        break;
      case "oldest":
        sort = { publishedAt: 1, createdAt: 1 };
        break;
      case "price_low":
        sort = { priceListed: 1 };
        break;
      case "price_high":
        sort = { priceListed: -1 };
        break;
      case "reputation":
        // Sắp xếp theo độ uy tín (có thể dựa trên số lượng view, rating, etc.)
        // Tạm thời sắp xếp theo publishedAt
        sort = { publishedAt: -1 };
        break;
      default:
        sort = { publishedAt: -1, createdAt: -1 };
    }

    // Pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 12;
    const skip = (pageNum - 1) * limitNum;

    // Execute query with population
    const listings = await Listing.find(filter)
      .populate("sellerId", "fullName phone avatar")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalCount = await Listing.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Tự động lưu lịch sử tìm kiếm nếu có keyword
    const userId = (req as any).user?._id;
    if (keyword && keyword.toString().trim()) {
      try {
        // Nếu user đã đăng nhập, lưu với userId, nếu không lưu với userId = null
        await SearchHistory.create({
          userId: userId || null,
          searchQuery: keyword.toString().trim(),
          searchType: "listing",
          filters: {
            make: make as string,
            model: model as string,
            year: year ? parseInt(year as string) : undefined,
            batteryCapacityKWh: batteryCapacityKWh ? parseInt(batteryCapacityKWh as string) : undefined,
            mileageKm: mileageKm ? parseInt(mileageKm as string) : undefined,
            minPrice: minPrice ? parseInt(minPrice as string) : undefined,
            maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
            city: city as string,
            district: district as string,
            condition: condition as string,
            sortBy: sortBy as string
          },
          resultsCount: totalCount,
          searchDate: new Date(),
          isSuccessful: true
        });
        console.log(`Search history saved for keyword: ${keyword}, userId: ${userId || 'anonymous'}`);
      } catch (err) {
        // Không làm fail API chính nếu lưu lịch sử bị lỗi
        console.error("Error saving search history:", err);
      }
    }


    // Response with pagination info
    res.json({
      listings,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum
      },
      filters: {
        keyword,
        make,
        model,
        year,
        batteryCapacityKWh,
        mileageKm,
        minPrice,
        maxPrice,
        city,
        district,
        condition,
        sortBy
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lấy danh sách các giá trị filter có sẵn (để populate dropdown)
 */
export const getFilterOptions: RequestHandler = async (req, res, next) => {
  try {
    const publishedListings = await Listing.find({ status: "Published" }).lean();

    // Extract unique values for each filter
    const makes = [...new Set(publishedListings.map(l => l.make).filter(Boolean))].sort();
    const models = [...new Set(publishedListings.map(l => l.model).filter(Boolean))].sort();
    const years = [...new Set(publishedListings.map(l => l.year).filter(Boolean))].sort((a, b) => (b || 0) - (a || 0));
    const batteryCapacities = [...new Set(publishedListings.map(l => l.batteryCapacityKWh).filter(Boolean))].sort((a, b) => (a || 0) - (b || 0));
    const conditions = [...new Set(publishedListings.map(l => l.condition).filter(Boolean))];
    const cities = [...new Set(publishedListings.map(l => l.location?.city).filter(Boolean))].sort();
    const districts = [...new Set(publishedListings.map(l => l.location?.district).filter(Boolean))].sort();

    // Price range
    const prices = publishedListings.map(l => l.priceListed).filter(Boolean);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    res.json({
      makes,
      models,
      years,
      batteryCapacities,
      conditions,
      cities,
      districts,
      priceRange: {
        min: minPrice,
        max: maxPrice
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lấy chi tiết sản phẩm theo ID (chỉ sản phẩm đã được duyệt)
 */
export const getListingById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({ message: "ID không hợp lệ" });
      return;
    }

    const listing = await Listing.findOne({
      _id: id,
      status: "Published" // Chỉ lấy sản phẩm đã được duyệt
    })
      .populate("sellerId", "fullName phone email avatar createdAt")
      .lean();

    if (!listing) {
      res.status(404).json({ message: "Sản phẩm không tồn tại hoặc chưa được duyệt" });
      return;
    }

    res.json(listing);
  } catch (err) {
    next(err);
  }
};

