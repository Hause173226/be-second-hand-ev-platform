import { Document } from "mongoose";

const PROFANITY = ["xxx", "lừa đảo", "scam"]; // ví dụ

export const moderationService = {
  async scanListing(listing: Document & any): Promise<boolean> {
    // Ảnh đủ số lượng
    if (!listing.photos || listing.photos.length < 3) return false;

    // Giá > 0
    if (!listing.priceListed || listing.priceListed <= 0) return false;

    // Không chứa từ cấm trong notes/make/model
    const text = `${listing.notes || ""} ${listing.make || ""} ${listing.model || ""}`.toLowerCase();
    if (PROFANITY.some(p => text.includes(p))) return false;

    // (có thể thêm check trùng ảnh / hash / EXIF…)
    return true;
  },
};
