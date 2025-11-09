import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getEkycConfig } from "../utils/config";

export type EkycInput = {
  idFrontPath: string;
  idBackPath?: string;
  facePath?: string;
  userId: string;
};

export type EkycResult = {
  refId: string;
  ocrData?: any;
  faceMatchScore?: number;
  livenessScore?: number;
  raw?: any;
};

function assertConfig() {
  const { baseUrl, apiKey } = getEkycConfig();
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Missing FPT eKYC configuration (require: BASE_URL, API_KEY)"
    );
  }
}

async function readFileAsBlob(filePathOrBuffer: string | Buffer): Promise<Blob> {
  let buf: Buffer;
  if (Buffer.isBuffer(filePathOrBuffer)) {
    buf = filePathOrBuffer;
  } else {
    const abs = path.resolve(filePathOrBuffer);
    buf = await fs.promises.readFile(abs);
  }
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Blob([ab as ArrayBuffer]);
}

export const fptEkycService = {
  // OCR CCCD/CMND (FPT Vision IDR VNM)
  async ocrId(imagePathOrBuffer: string | Buffer): Promise<any> {
    assertConfig();
    const { baseUrl, apiKey } = getEkycConfig();

    const form = new FormData();
    form.append("image", await readFileAsBlob(imagePathOrBuffer), "id.jpg");

    const url = `${baseUrl.replace(/\/$/, "")}/vision/idr/vnm`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "api-key": apiKey } as any,
      body: form as any,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`FPT OCR error ${res.status}: ${text}`);
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  },

  // FaceMatch (FPT DMP checkface) — cần 2 file
  async checkFaceMatch(file1PathOrBuffer: string | Buffer, file2PathOrBuffer: string | Buffer): Promise<any> {
    assertConfig();
    const { baseUrl, apiKey } = getEkycConfig();

    const form = new FormData();
    form.append("file[]", await readFileAsBlob(file1PathOrBuffer), "a.jpg");
    form.append("file[]", await readFileAsBlob(file2PathOrBuffer), "b.jpg");

    const url = `${baseUrl.replace(/\/$/, "")}/dmp/checkface/v1`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "api-key": apiKey } as any,
      body: form as any,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`FPT FaceMatch error ${res.status}: ${text}`);
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  },

  async verify(input: EkycInput): Promise<EkycResult> {
    // Giữ lại hàm tổng hợp nếu sau này bạn có endpoint hợp nhất; hiện không dùng apiSecret
    assertConfig();
    const { baseUrl, apiKey } = getEkycConfig();

    // NOTE: Các endpoint cụ thể của FPT eKYC có thể khác nhau tùy gói dịch vụ.
    // Ở đây triển khai mẫu với multipart: form-data để OCR + Face Match đồng bộ.

    const form = new FormData();
    form.append(
      "id_front",
      await readFileAsBlob(input.idFrontPath),
      "id_front.jpg"
    );
    if (input.idBackPath)
      form.append(
        "id_back",
        await readFileAsBlob(input.idBackPath),
        "id_back.jpg"
      );
    if (input.facePath)
      form.append("face", await readFileAsBlob(input.facePath), "face.jpg");

    // Ví dụ endpoint hợp nhất (nếu có); mặc định không dùng
    const headers: Record<string, string> = { "api-key": apiKey };
    const url = `${baseUrl.replace(/\/$/, "")}/ekyc/verify`;
    const res = await fetch(url, {
      method: "POST",
      body: form as any,
      headers: headers as any,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`FPT eKYC error ${res.status}: ${text}`);
    }
    let json: any = {};
    try {
      json = JSON.parse(text);
    } catch {
      /* raw text fallback */
    }

    const refId = String(
      json?.ref_id || json?.reference_id || crypto.randomUUID()
    );
    const result: EkycResult = {
      refId,
      ocrData: json?.ocr || json?.data?.ocr,
      faceMatchScore: Number(
        json?.face_match_score ?? json?.data?.face_match_score ?? NaN
      ),
      livenessScore: Number(
        json?.liveness_score ?? json?.data?.liveness_score ?? NaN
      ),
      raw: json,
    };
    return result;
  },
};
