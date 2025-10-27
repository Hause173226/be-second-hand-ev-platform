import { RequestHandler } from "express";
import Listing from "../models/Listing";

export const pendingQueue: RequestHandler = async (_req, res, next) => {
  try {
    const list = await Listing.find({ status: "PendingReview" })
      .populate("sellerId", "fullName phone avatar")
      .sort({ createdAt: 1 });
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
    listing.set("rejectReason", reason || "Không đạt tiêu chuẩn");
    await listing.save();

    // TODO: gửi notification/email
    res.json({ message: "Đã từ chối", listing });
  } catch (err) {
    next(err);
  }
};
