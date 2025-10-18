// src/services/moderationService.ts
import { Document } from "mongoose";

export type ModResult = {
  ok: boolean;
  reasons: string[];
};

export const moderationService = {
  async scanListing(listing: Document | any): Promise<ModResult> {
    const reasons: string[] = [];

    // 1. Kiểm tra số lượng ảnh
    if (!Array.isArray(listing.photos) || listing.photos.length < 3) {
      reasons.push("Thiếu ảnh minh hoạ (cần >= 3).");
    }

    // 2. Kiểm tra giá
    if (!listing.priceListed || listing.priceListed <= 0) {
      reasons.push("Giá niêm yết không hợp lệ.");
    }

    // 3. Kiểm tra thông tin vị trí
    if (
      !listing.location?.city ||
      !listing.location?.district ||
      !listing.location?.address
    ) {
      reasons.push("Thiếu thông tin vị trí (city/district/address).");
    }

    // 4. Kiểm tra từ ngữ cấm trong tiêu đề hoặc ghi chú
    const PROFANITY = ["xxx", "lừa đảo", "fake", "scam"];
    const text = `${listing.title || ""} ${listing.notes || ""}`.toLowerCase();
    if (PROFANITY.some((p) => text.includes(p))) {
      reasons.push("Phát hiện từ ngữ cấm/nhạy cảm.");
    }

    // 5. So sánh giá với gợi ý AI (nếu có)
    if (listing.pricingSuggestion?.suggested) {
      const deviation =
        Math.abs(listing.priceListed - listing.pricingSuggestion.suggested) /
        listing.pricingSuggestion.suggested;
      if (deviation > 0.4) {
        reasons.push("Giá lệch quá lớn so với giá tham chiếu.");
      }
    }

    return { ok: reasons.length === 0, reasons };
  },
};
