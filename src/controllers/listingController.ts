// src/controllers/listingController.ts
import { RequestHandler } from "express";
import Listing from "../models/Listing";
import { moderationService } from "../services/moderationService";
import { SearchHistory } from "../models/SearchHistory";

// Heuristic only (theo yêu cầu tạm thời không dùng Gemini)
import { suggestHeuristic } from "../services/priceAI.heuristic";
import { PriceAIInput } from "../services/priceAI.types";

// ⬇️ NEW: dùng kiểu để type-narrowing cho union
import type {
  IListing,
} from "../interfaces/IListing"

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

// ⬇️ NEW: type guards cho union
const isCar = (l: IListing): l is IListing & { type: "Car" } => l?.type === "Car";
const isBattery = (l: IListing): l is IListing & { type: "Battery" } => l?.type === "Battery";

/**
 * Tạo listing (status = Draft)
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
      priceListed,
      tradeMethod,
      sellerConfirm,
      location,

      // ⬇️ NEW: các field hợp đồng (Car)
      licensePlate,
      engineDisplacementCc,
      vehicleType,
      paintColor,
      engineNumber,
      chassisNumber,
      otherFeatures,
    } = req.body as any;

    const locObj = parseLocation(location);
    const confirmed = toBool(sellerConfirm);

    // ép & validate priceListed
    const priceListedNum =
      typeof priceListed === "string" ? Number(priceListed) : Number(priceListed);
    if (!Number.isFinite(priceListedNum) || priceListedNum < 0) {
      res.status(400).json({ message: "priceListed không hợp lệ" });
      return;
    }

    // validate tradeMethod
    const ALLOWED_TRADE: Array<"meet" | "ship" | "consignment"> = [
      "meet",
      "ship",
      "consignment",
    ];
    const trade =
      typeof tradeMethod === "string" && ALLOWED_TRADE.includes(tradeMethod as any)
        ? (tradeMethod as any)
        : "meet";

    // Ảnh từ CloudinaryStorage
    const photos: { url: string; kind: "photo"; publicId?: string }[] =
      files.map((f) => ({
        url: (f as any).path,
        kind: "photo",
        publicId: (f as any).filename,
      }));

    // ⬇️ NEW: payload base + spread theo type để đúng union
    const base: Partial<IListing> = {
      sellerId,
      type,
      make,
      model,
      year: year ? Number(year) : undefined,
      mileageKm: mileageKm ? Number(mileageKm) : undefined,
      condition,
      photos,
      location: locObj as any,
      priceListed: priceListedNum,
      tradeMethod: trade,
      status: "Draft",
      notes: confirmed ? undefined : "Chưa xác nhận chính chủ",
    };

    const payload: any =
      type === "Car"
        ? {
            ...base,
            licensePlate,
            engineDisplacementCc: engineDisplacementCc ? Number(engineDisplacementCc) : undefined,
            vehicleType,
            paintColor,
            engineNumber,
            chassisNumber,
            otherFeatures,
          }
        : {
            ...base,
            batteryCapacityKWh: batteryCapacityKWh ? Number(batteryCapacityKWh) : undefined,
            chargeCycles: chargeCycles ? Number(chargeCycles) : undefined,
          };

    const listing = await Listing.create(payload);

    res.status(201).json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * Cập nhật listing (chỉ khi Draft/Rejected)
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
    if (!isOwner(userId, (listing as any).sellerId)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (!(typeof (listing as any).status === "string" && ["Draft", "Rejected"].includes((listing as any).status))) {
      res.status(409).json({ message: "Chỉ sửa khi Draft/Rejected" });
      return;
    }

    // Ảnh mới (nếu có)
    const files = (req.files as MulterCloudinaryFile[]) || [];
    if (Array.isArray(files) && files.length > 0) {
      const newPhotos = files.map((f) => ({
        url: (f as any).path,
        kind: "photo" as const,
        publicId: (f as any).filename,
      }));
      (listing as any).photos = [...((listing as any).photos || []), ...newPhotos];
    }

    // ⬇️ NEW: bổ sung các field hợp đồng cho Car
    const allowedCommon: Array<
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

    const allowedCar: Array<
      | "licensePlate"
      | "engineDisplacementCc"
      | "vehicleType"
      | "paintColor"
      | "engineNumber"
      | "chassisNumber"
      | "otherFeatures"
    > = [
      "licensePlate",
      "engineDisplacementCc",
      "vehicleType",
      "paintColor",
      "engineNumber",
      "chassisNumber",
      "otherFeatures",
    ];

    // Cập nhật các field chung
    for (const k of allowedCommon) {
      if (typeof (req.body as any)[k] === "undefined") continue;

      if (k === "location") {
        (listing as any).location = parseLocation((req.body as any).location);
        continue;
      }

      if (k === "sellerConfirm") {
        const confirmed = toBool((req.body as any).sellerConfirm);
        (listing as any).notes = confirmed ? undefined : "Chưa xác nhận chính chủ";
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

    // ⬇️ NEW: chỉ cho phép field Car nếu listing.type === "Car"
    if ((listing as any).type === "Car") {
      for (const k of allowedCar) {
        if (typeof (req.body as any)[k] === "undefined") continue;

        if (k === "engineDisplacementCc") {
          const n = Number((req.body as any)[k]);
          (listing as any)[k] = Number.isFinite(n) ? n : undefined;
          continue;
        }

        (listing as any)[k] = (req.body as any)[k];
      }
    }

    await (listing as any).save();
    res.json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * Submit listing để duyệt (Draft/Rejected -> PendingReview)
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
    if (!isOwner(userId, (listing as any).sellerId)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (!(typeof (listing as any).status === "string" && ["Draft", "Rejected"].includes((listing as any).status))) {
      res.status(409).json({ message: "Chỉ submit khi Draft/Rejected" });
      return;
    }

    const acceptedTerms = toBool((req.body as any)?.commissionTermsAccepted ?? "true");
    if (acceptedTerms !== true) {
      res.status(400).json({
        message: "Bạn phải đồng ý Điều khoản & Phí hoa hồng trước khi submit.",
        field: "commissionTermsAccepted",
      });
      return;
    }

    if (!(listing as any).photos || (listing as any).photos.length < 3) {
      res.status(400).json({ message: "Cần tối thiểu 3 ảnh trước khi submit" });
      return;
    }
    if (
      (listing as any).priceListed === undefined ||
      (listing as any).priceListed === null ||
      !(listing as any).location?.city ||
      !(listing as any).location?.district ||
      !(listing as any).location?.address
    ) {
      res.status(400).json({ message: "Thiếu dữ liệu bắt buộc (giá, vị trí...)" });
      return;
    }
    if (!(listing as any).tradeMethod) {
      res.status(400).json({ message: "Thiếu hình thức giao dịch (tradeMethod)" });
      return;
    }

    const mod = await moderationService.scanListing(listing as any);
    if (!mod.ok) {
      res.status(400).json({ message: "Auto moderation failed", reasons: mod.reasons });
      return;
    }

    (listing as any).status = "PendingReview";
    (listing as any).rejectReason = undefined;
    await (listing as any).save();

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

export const priceSuggestionAI: RequestHandler = async (req, res, next) => {
  try {
    const payload = req.body as PriceAIInput;

    if (!payload?.make || !payload?.model || !payload?.year) {
      res.status(400).json({ message: "Thiếu make/model/year" });
      return;
    }

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
      if (Number.isFinite(b)) filter.batteryCapacityKWh = b; // chỉ match Battery trong DB
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
    // ⬇️ cast về union để dùng narrowing
    const publishedListings = (await Listing.find({ status: "Published" }).lean()) as IListing[];

    const makes = [...new Set(publishedListings.map(l => l.make).filter(Boolean))].sort();
    const models = [...new Set(publishedListings.map(l => l.model).filter(Boolean))].sort();
    const years = [
      ...new Set(publishedListings.map(l => l.year).filter((v): v is number => typeof v === "number")),
    ].sort((a, b) => b - a);

    // ⬇️ NEW: chỉ lấy batteryCapacityKWh cho Battery
    const batteryCapacities = [
      ...new Set(
        publishedListings
          .filter(isBattery)
          .map(l => l.batteryCapacityKWh)
          .filter((v): v is number => typeof v === "number")
      ),
    ].sort((a, b) => a - b);

    const conditions = [...new Set(publishedListings.map(l => l.condition).filter(Boolean))];
    const cities = [...new Set(publishedListings.map(l => l.location?.city).filter(Boolean))].sort();
    const districts = [...new Set(publishedListings.map(l => l.location?.district).filter(Boolean))].sort();

    const priceVals = publishedListings
      .map(l => l.priceListed)
      .filter((v): v is number => typeof v === "number");
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
