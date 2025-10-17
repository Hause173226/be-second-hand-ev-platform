import { RequestHandler } from "express";
import Listing from "../models/Listing";
import { moderationService } from "../services/moderationService";
import { priceAIService } from "../services/priceAIService";

const isOwner = (userId?: string, sellerId?: any) =>
  userId && sellerId && sellerId.toString() === userId.toString();

export const createListing: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = (req as any).user?._id;
    if (!sellerId) { res.status(401).json({ message: "Unauthorized" }); return; }

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length < 3) {
      res.status(400).json({ message: "Cần tối thiểu 3 ảnh" }); return;
    }
    const photos = files.map(f => ({ url: `/uploads/${f.filename}`, kind: "photo" }));

    const {
      type, make, model, year,
      batteryCapacityKWh, mileageKm, chargeCycles,
      condition, priceListed, sellerConfirm, location,
    } = req.body;

    const locObj = typeof location === "string" ? JSON.parse(location) : location;

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
      location: locObj,
      priceListed,
      status: "Draft",
      notes: sellerConfirm ? undefined : "Chưa xác nhận chính chủ",
    });

    res.status(201).json(listing);
  } catch (err) { next(err); }
};

export const updateListing: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as any).user?._id;
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) { res.status(404).json({ message: "Listing không tồn tại" }); return; }
    if (!isOwner(userId, listing.sellerId)) { res.status(403).json({ message: "Forbidden" }); return; }
    if (!["Draft", "Rejected"].includes(listing.status)) {
      res.status(409).json({ message: "Chỉ sửa khi Draft/Rejected" }); return;
    }

    const allowed = [
      "type", "make", "model", "year", "batteryCapacityKWh", "mileageKm", "chargeCycles",
      "condition", "priceListed", "sellerConfirm", "location", "notes"
    ];
    for (const k of allowed) {
      if (typeof (req.body as any)[k] !== "undefined") {
        if (k === "location") {
          (listing as any)[k] = typeof req.body.location === "string" ? JSON.parse(req.body.location) : req.body.location;
        } else {
          (listing as any)[k] = (req.body as any)[k];
        }
      }
    }
    await listing.save();
    res.json(listing);
  } catch (err) { next(err); }
};

export const submitListing: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as any).user?._id;
    const { id } = req.params;

    const listing = await Listing.findById(id);
    if (!listing) { res.status(404).json({ message: "Listing không tồn tại" }); return; }
    if (!isOwner(userId, listing.sellerId)) { res.status(403).json({ message: "Forbidden" }); return; }
    if (!["Draft", "Rejected"].includes(listing.status)) {
      res.status(409).json({ message: "Chỉ submit khi Draft/Rejected" }); return;
    }

    if (!listing.photos || listing.photos.length < 3) {
      res.status(400).json({ message: "Cần tối thiểu 3 ảnh trước khi submit" }); return;
    }
    if (!listing.priceListed || !listing.location?.city || !listing.location?.district || !listing.location?.address) {
      res.status(400).json({ message: "Thiếu dữ liệu bắt buộc (giá, vị trí...)" }); return;
    }

    const ok = await moderationService.scanListing(listing);
    if (!ok) { res.status(400).json({ message: "Auto moderation failed" }); return; }

    listing.status = "PendingReview";
    listing.set("rejectReason", undefined);
    await listing.save();
    res.json({ message: "Đã submit, chờ duyệt", listing });
  } catch (err) { next(err); }
};

export const myListings: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = (req as any).user?._id;
    const list = await Listing.find({ sellerId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) { next(err); }
};

// ---------- AI PRICE SUGGESTION ----------
export const priceSuggestionAI: RequestHandler = async (req, res, next) => {
  try {
    const payload = req.body; // { type, year, mileageKm, batteryCapacityKWh, condition, make, model }
    const result = await priceAIService.suggest(payload);
    res.json(result);
  } catch (err) { next(err); }
};
