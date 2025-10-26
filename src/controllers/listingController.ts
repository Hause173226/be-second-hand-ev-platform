// src/controllers/listingController.ts
import { RequestHandler } from "express";
import Listing from "../models/Listing";
import { moderationService } from "../services/moderationService";
import { SearchHistory } from "../models/SearchHistory";

// Heuristic only (theo yêu cầu tạm thời không dùng Gemini)
import { suggestHeuristic } from "../services/priceAI.heuristic";
import { PriceAIInput } from "../services/priceAI.types";

// ❌ BỎ Firebase
// import { uploadImageToFirebase } from "../services/fileStorage";

// ✅ Dùng Cloudinary qua multer-storage-cloudinary
// Khi dùng CloudinaryStorage, multer sẽ trả về file có .path (URL) và .filename (public_id)
type MulterCloudinaryFile = Express.Multer.File & {
  path: string;     // Cloudinary URL
  filename: string; // Cloudinary public_id
};

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

const toBool = (v: unknown) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  return Boolean(v);
};

/**
 * Tạo listing (status = Draft)
 * (Phần 15) Parse & validate priceListed + tradeMethod
 * (Cloudinary) Ảnh đã được upload bởi multer-storage-cloudinary => lấy URL + publicId
 * (NEW) Bắt buộc commissionTermsAccepted = true
 */
export const createListing: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = (req as any).user?._id;
    if (!sellerId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // ✅ BẮT BUỘC đồng ý điều khoản & phí hoa hồng
    const acceptedTerms = toBool((req.body as any)?.commissionTermsAccepted);
    if (acceptedTerms !== true) {
      res.status(400).json({
        message:
          "Bạn phải đồng ý Điều khoản & Phí hoa hồng trước khi đăng bán (commissionTermsAccepted=true).",
        field: "commissionTermsAccepted",
      });
      return;
    }

    const files = (req.files as MulterCloudinaryFile[]) || [];
    if (!Array.isArray(files) || files.length < 3) {
      res.status(400).json({ message: "Cần tối thiểu 3 ảnh" });
      return;
    }

    const {
      type,
      make,
      model,
      year,
      batteryCapacityKWh,
      mileageKm,
      chargeCycles,
      condition,
      priceListed, // ⬅️ phần 15
      tradeMethod, // ⬅️ phần 15
      sellerConfirm,
      location,
    } = req.body;

    const locObj = parseLocation(location);
    const confirmed = toBool(sellerConfirm);

    // (15) ép & validate priceListed
    const priceListedNum =
      typeof priceListed === "string" ? Number(priceListed) : Number(priceListed);
    if (!Number.isFinite(priceListedNum) || priceListedNum < 0) {
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

    // ✅ Ảnh đã ở Cloudinary: lấy trực tiếp từ multer
    // Giữ nguyên cấu trúc cũ `photos: { url, kind }[]`, đồng thời thêm `publicId` để sau này xoá/sửa.
    const photos: { url: string; kind: "photo"; publicId?: string }[] =
      files.map((f) => ({
        url: (f as any).path,         // Cloudinary URL
        kind: "photo",
        publicId: (f as any).filename // Cloudinary public_id
      }));

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
      location: locObj, // schema hiện để object đơn giản
      priceListed: priceListedNum,
      tradeMethod: trade,
      status: "Draft",
      notes: confirmed ? undefined : "Chưa xác nhận chính chủ",
      // Nếu đã thêm field mới trong schema có thể set:
      // commissionTermsAccepted: true,
      // commissionTermsAcceptedAt: new Date(),
    });

    res.status(201).json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * Cập nhật listing (chỉ khi Draft/Rejected)
 * (Phần 15) Cho phép sửa priceListed + tradeMethod
 * (Cloudinary) Nếu PATCH có gửi ảnh (multipart) thì ảnh đã ở Cloudinary → append vào photos
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
    if (!(typeof listing.status === "string" && ["Draft", "Rejected"].includes(listing.status))) {
      res.status(409).json({ message: "Chỉ sửa khi Draft/Rejected" });
      return;
    }

    // ✅ Ảnh mới (nếu có) — đã upload qua CloudinaryStorage
    const files = (req.files as MulterCloudinaryFile[]) || [];
    if (Array.isArray(files) && files.length > 0) {
      const newPhotos = files.map((f) => ({
        url: (f as any).path,
        kind: "photo" as const,
        publicId: (f as any).filename,
      }));
      // Append thay vì replace
      (listing as any).photos = [...(listing.photos || []), ...newPhotos];
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
        if (!Number.isFinite(n) || n < 0) {
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
 * (NEW) Re-check đã đồng ý điều khoản khi submit (phòng client lách)
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
    if (!(typeof listing.status === "string" && ["Draft", "Rejected"].includes(listing.status))) {
      res.status(409).json({ message: "Chỉ submit khi Draft/Rejected" });
      return;
    }

    // ✅ Optional: bắt client gửi lại commissionTermsAccepted (true)
    const acceptedTerms = toBool((req.body as any)?.commissionTermsAccepted ?? "true");
    if (acceptedTerms !== true) {
      res.status(400).json({
        message: "Bạn phải đồng ý Điều khoản & Phí hoa hồng trước khi submit.",
        field: "commissionTermsAccepted",
      });
      return;
    }

    // validate dữ liệu bắt buộc tối thiểu
    if (!listing.photos || listing.photos.length < 3) {
      res.status(400).json({ message: "Cần tối thiểu 3 ảnh trước khi submit" });
      return;
    }
    if (
      listing.priceListed === undefined ||
      listing.priceListed === null ||
      !listing.location?.city ||
      !listing.location?.district ||
      !listing.location?.address
    ) {
      res.status(400).json({ message: "Thiếu dữ liệu bắt buộc (giá, vị trí...)" });
      return;
    }
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
      type,
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
      limit = "12",
    } = req.query;

    const filter: any = { status: "Published" };

    // Text search với keyword - thông minh hơn với make, model, year
    if (keyword) {
      const keywordStr = keyword.toString().trim();
      
      // Tách keyword thành các từ
      const words = keywordStr.split(/\s+/);
      
      // Tìm năm trong keyword (4 chữ số liên tiếp)
      const yearMatch = keywordStr.match(/\b(19|20)\d{2}\b/);
      const yearFromKeyword = yearMatch ? parseInt(yearMatch[0], 10) : null;
      
      // Xây dựng điều kiện search thông minh
      const searchConditions: any[] = [
        { make: { $regex: keywordStr, $options: "i" } },
        { model: { $regex: keywordStr, $options: "i" } },
        { notes: { $regex: keywordStr, $options: "i" } },
      ];
      
      // Nếu có nhiều từ, thử tìm theo kết hợp make + model
      if (words.length >= 2) {
        // Ví dụ: "Tesla Model" hoặc "Tesla Model 3"
        const possibleMake = words[0];
        const possibleModel = words.slice(1).join(" ").replace(/\b(19|20)\d{2}\b/, "").trim();
        
        if (possibleModel) {
          searchConditions.push({
            $and: [
              { make: { $regex: possibleMake, $options: "i" } },
              { model: { $regex: possibleModel, $options: "i" } },
            ],
          });
        }
      }
      
      // Nếu tìm thấy năm trong keyword, thêm điều kiện tìm theo năm
      if (yearFromKeyword) {
        searchConditions.push({
          $and: [
            { year: yearFromKeyword },
            {
              $or: [
                { make: { $regex: keywordStr.replace(/\b(19|20)\d{2}\b/, "").trim(), $options: "i" } },
                { model: { $regex: keywordStr.replace(/\b(19|20)\d{2}\b/, "").trim(), $options: "i" } },
              ],
            },
          ],
        });
      }
      
      filter.$or = searchConditions;
    }

    // Filter theo type (Car hoặc Battery)
    if (type) {
      filter.type = type;
    }

    if (make) filter.make = { $regex: make, $options: "i" };
    if (model) filter.model = { $regex: model, $options: "i" };

    if (year) {
      const y = parseInt(year as string, 10);
      if (Number.isFinite(y)) filter.year = y;
    }
    if (batteryCapacityKWh) {
      const b = parseInt(batteryCapacityKWh as string, 10);
      if (Number.isFinite(b)) filter.batteryCapacityKWh = b;
    }
    if (mileageKm) {
      const m = parseInt(mileageKm as string, 10);
      if (Number.isFinite(m)) filter.mileageKm = { $lte: m };
    }

    if (condition) filter.condition = condition;

    if (minPrice || maxPrice) {
      const g: any = {};
      const min = minPrice ? parseInt(minPrice as string, 10) : undefined;
      const max = maxPrice ? parseInt(maxPrice as string, 10) : undefined;
      if (Number.isFinite(min as number)) g.$gte = min;
      if (Number.isFinite(max as number)) g.$lte = max;
      if (Object.keys(g).length) filter.priceListed = g;
    }

    if (city || district) {
      if (city) filter["location.city"] = { $regex: city as string, $options: "i" };
      if (district) filter["location.district"] = { $regex: district as string, $options: "i" };
    }

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
        sort = { publishedAt: -1 };
        break;
      default:
        sort = { publishedAt: -1, createdAt: -1 };
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 12;
    const skip = (pageNum - 1) * limitNum;

    const listings = await Listing.find(filter)
      .populate("sellerId", "fullName phone avatar")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await Listing.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    const userId = (req as any).user?._id;
    if (keyword && keyword.toString().trim()) {
      try {
        await SearchHistory.create({
          userId: userId || null,
          searchQuery: keyword.toString().trim(),
          searchType: "listing",
          filters: {
            type: type as string,
            make: make as string,
            model: model as string,
            year: year ? parseInt(year as string, 10) : undefined,
            batteryCapacityKWh: batteryCapacityKWh ? parseInt(batteryCapacityKWh as string, 10) : undefined,
            mileageKm: mileageKm ? parseInt(mileageKm as string, 10) : undefined,
            minPrice: minPrice ? parseInt(minPrice as string, 10) : undefined,
            maxPrice: maxPrice ? parseInt(maxPrice as string, 10) : undefined,
            city: city as string,
            district: district as string,
            condition: condition as string,
            sortBy: sortBy as string,
          },
          resultsCount: totalCount,
          searchDate: new Date(),
          isSuccessful: true,
        });
        console.log(`Search history saved for keyword: ${keyword}, userId: ${userId || "anonymous"}`);
      } catch (err) {
        console.error("Error saving search history:", err);
      }
    }

    res.json({
      listings,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum,
      },
      filters: {
        keyword,
        type,
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
        sortBy,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lấy danh sách các giá trị filter có sẵn (để populate dropdown)
 */
export const getFilterOptions: RequestHandler = async (_req, res, next) => {
  try {
    const publishedListings = await Listing.find({ status: "Published" }).lean();

    const makes = [...new Set(publishedListings.map(l => l.make).filter(Boolean))].sort();
    const models = [...new Set(publishedListings.map(l => l.model).filter(Boolean))].sort();
    const years = [...new Set(publishedListings.map(l => l.year).filter((v): v is number => typeof v === "number"))]
      .sort((a, b) => b - a);
    const batteryCapacities = [
      ...new Set(
        publishedListings.map(l => l.batteryCapacityKWh).filter((v): v is number => typeof v === "number")
      ),
    ].sort((a, b) => a - b);
    const conditions = [...new Set(publishedListings.map(l => l.condition).filter(Boolean))];
    const cities = [...new Set(publishedListings.map(l => l.location?.city).filter(Boolean))].sort();
    const districts = [...new Set(publishedListings.map(l => l.location?.district).filter(Boolean))].sort();

    const priceVals = publishedListings.map(l => l.priceListed).filter((v): v is number => typeof v === "number");
    const minPrice = priceVals.length ? Math.min(...priceVals) : 0;
    const maxPrice = priceVals.length ? Math.max(...priceVals) : 0;

    res.json({
      makes,
      models,
      years,
      batteryCapacities,
      conditions,
      cities,
      districts,
      priceRange: { min: minPrice, max: maxPrice },
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
      status: "Published",
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
