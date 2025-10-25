// src/services/priceAI.types.ts

/* ================== Client-side types (request body) ================== */

// Tình trạng mà FE gửi lên
export type ClientCondition = "New" | "LikeNew" | "Used" | "Worn";

// Input từ client gửi lên API
export interface PriceAIInput {
  type: string;               // "Car" | "Bike" | ...
  make: string;               // hãng xe
  model: string;
  year: number;
  mileageKm?: number;         // có thể undefined
  batteryCapacityKWh?: number;// có thể undefined
  condition?: ClientCondition;
}

/* ================== Normalized suggestion (common response) ================== */

// Kết quả trả về (dùng chung cho heuristic & Gemini sau khi normalize)
export interface PriceAISuggest {
  suggested: number;                          // giá gợi ý trung bình
  range: { min: number; max: number };        // khoảng giá
  currency: string;                           // "USD"
  confidence: "low" | "medium" | "high";
  rationale_short: string;                    // "Gemini" | "Heuristic" ...
  factors: any;                               // echo input lại (debug / tham khảo)
}

/* ================== Gemini-specific types (adapter layer) ================== */

// Tình trạng theo ngôn ngữ của Gemini
export type GeminiCondition = "excellent" | "good" | "fair";

// Input chuẩn cho Gemini AI (không để undefined ở numeric fields)
export interface PriceSuggestInput {
  brand: string;
  model: string;
  year: number;
  mileageKm: number;          // luôn number (nếu thiếu thì mapping = 0)
  batteryKWh: number;         // luôn number (nếu thiếu thì mapping = 0)
  condition: GeminiCondition; // mapped từ ClientCondition
  type: string;               // "Car" | "Bike" ...
}

// Output thô từ Gemini (trước khi normalize về PriceAISuggest)
export interface PriceSuggestResult {
  suggestedPrice: number;
  rangeMin: number;
  rangeMax: number;
}
