import "dotenv/config";

const V1 = "https://generativelanguage.googleapis.com/v1";
const V1B = "https://generativelanguage.googleapis.com/v1beta";

let cachedModel: string | null = null;
let cachedBase: "v1" | "v1beta" | null = null;

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("Missing GEMINI_API_KEY");
  return k;
}

async function fetchJSON(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}: ${t}`);
  return JSON.parse(t);
}

/** List models: thử v1 rồi v1beta */
async function listModels(): Promise<{ name: string; methods: string[]; base: "v1" | "v1beta" }[]> {
  const k = key();
  for (const base of [V1, V1B] as const) {
    try {
      const j = await fetchJSON(`${base}/models?key=${encodeURIComponent(k)}`);
      const arr = (j.models || []).map((m: any) => ({
        name: String(m.name || "").replace(/^models\//, ""),
        methods: (m.supportedGenerationMethods || []).map(String),
        base: base === V1 ? "v1" : "v1beta",
      }));
      if (arr.length) return arr;
    } catch { /* thử base còn lại */ }
  }
  throw new Error("ListModels failed on both v1 and v1beta");
}

async function callModelAuto(model: string, prompt: string, timeoutMs: number) {
  const k = key();

  const doCall = async (baseUrl: string) => {
    const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(k)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          responseMimeType: "application/json", // ép trả JSON
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
      signal: controller.signal,
    }).catch(e => { throw new Error(`fetch failed: ${e instanceof Error ? e.message : String(e)}`); });

    clearTimeout(timer);
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}: ${txt}`);

    const json = JSON.parse(txt);
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const joined = parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("").trim();
    if (!joined) {
      const fin = json?.candidates?.[0]?.finishReason;
      const fb = json?.promptFeedback;
      throw new Error(`Empty Gemini response (finish=${fin || "?"}, feedback=${JSON.stringify(fb || {})})`);
    }
    return joined;
  };

  // thử v1 trước → nếu 404 thì v1beta
  try {
    const text = await doCall(V1);
    cachedBase = "v1";
    return { text, base: "v1" as const };
  } catch (e: any) {
    if (!String(e?.message).includes("HTTP 404")) throw e;
    const text = await doCall(V1B);
    cachedBase = "v1beta";
    return { text, base: "v1beta" as const };
  }
}

/** Chọn model generateContent; ưu tiên 2.5/2.0 rồi 1.5/pro; cache lại */
async function pickModel(): Promise<{ model: string; baseHint: "v1" | "v1beta" | null }> {
  if (cachedModel) return { model: cachedModel, baseHint: cachedBase };

  const preferred = (process.env.GEMINI_MODEL || "").trim();
  const tryOrder = [
    preferred || "",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-pro",
  ].filter(Boolean);

  const models = await listModels();
  const canGen = models.filter(m => m.methods.includes("generateContent"));
  const avail = canGen.map(m => m.name);

  for (const name of [...new Set(tryOrder)]) {
    if (!avail.includes(name)) continue;
    try {
      await callModelAuto(name, "ping", 3000);
      cachedModel = name;
      return { model: name, baseHint: cachedBase };
    } catch (e: any) {
      if (!String(e?.message).includes("HTTP 404")) throw e; // lỗi khác: dừng để báo thật
    }
  }

  // nếu chưa chọn được, thử bất kỳ cái nào có generateContent
  for (const m of canGen) {
    try {
      await callModelAuto(m.name, "ping", 3000);
      cachedModel = m.name;
      return { model: m.name, baseHint: cachedBase };
    } catch { /* thử tiếp */ }
  }

  throw new Error(`[Gemini] No usable model found. Available: ${avail.join(", ")}`);
}

export async function geminiGenerateJson(prompt: string, { timeoutMs = 6000 } = {}) {
  const { model } = await pickModel();
  const { text, base } = await callModelAuto(model, prompt, timeoutMs);
  return { text, usedModel: model, usedBase: base };
}
