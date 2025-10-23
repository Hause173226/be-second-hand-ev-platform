// src/services/priceAI.gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PriceSuggestInput, PriceSuggestResult } from "./priceAI.types";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const DEFAULT_TIMEOUT = Number(process.env.GEMINI_TIMEOUT_MS || 8000);

// Helper: bọc promise với timeout
function withTimeout<T>(p: Promise<T>, ms: number, label = "gemini"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`[${label}] timeout ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

export async function geminiSuggest(input: PriceSuggestInput): Promise<PriceSuggestResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);

  const systemPrompt = `
Bạn là chuyên gia định giá xe điện đã qua sử dụng.
Chỉ trả về JSON đúng schema:
{
  "suggestedPrice": number,
  "rangeMin": number,
  "rangeMax": number
}
Đơn vị: USD. Không thêm chữ/thuyết minh ngoài JSON.
  `.trim();

  const model = genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 300,
    },
  });

  // Chỉ truyền những field có trong PriceSuggestInput (không có location)
  const userInput = {
    brand: input.brand,
    model: input.model,
    year: input.year,
    mileageKm: input.mileageKm,
    batteryKWh: input.batteryKWh,
    condition: input.condition, // "excellent" | "good" | "fair"
    type: input.type,
  };

  try {
    const res = await withTimeout(
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(userInput) }],
          },
        ],
      }),
      DEFAULT_TIMEOUT,
      "gemini-generate"
    );

    const text = res.response.text(); // JSON string
    const parsed = JSON.parse(text);

    const suggestedPrice = Number(parsed?.suggestedPrice);
    const rangeMin = Number(parsed?.rangeMin);
    const rangeMax = Number(parsed?.rangeMax);

    if (
      !Number.isFinite(suggestedPrice) ||
      !Number.isFinite(rangeMin) ||
      !Number.isFinite(rangeMax)
    ) {
      throw new Error("Gemini returned invalid numbers");
    }

    const out: PriceSuggestResult = {
      suggestedPrice: Math.round(suggestedPrice),
      rangeMin: Math.round(rangeMin),
      rangeMax: Math.round(rangeMax),
    };
    return out;
  } catch (e: any) {
    // Ném lỗi để controller/ orchestrator fallback sang heuristic
    const msg = e?.message || String(e);
    throw new Error(`[GeminiFree] ${msg}`);
  }
}

export default geminiSuggest;
