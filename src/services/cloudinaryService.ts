// src/services/cloudinaryService.ts
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from "cloudinary";

/** ---------- Init (with guards) ---------- */
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER } =
  process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  // Không throw để dev server vẫn chạy; nhưng log rõ để dễ phát hiện
  // Nếu muốn fail-fast, có thể throw new Error("Missing Cloudinary env...")
  console.warn("[cloudinary] Missing credentials. Please set CLOUDINARY_* env vars.");
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

export type CloudinaryUpload = {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
};

const DEFAULT_FOLDER = CLOUDINARY_FOLDER || "secondhand-ev/listings";

/** Gộp options mặc định với options truyền vào */
function withDefaults(options?: UploadApiOptions): UploadApiOptions {
  return {
    folder: DEFAULT_FOLDER,
    resource_type: "image",
    // để tránh ghi đè khi trùng tên file
    unique_filename: true,
    overwrite: false,
    ...options,
  };
}

/** Chuẩn hoá base64: chấp nhận cả data URL & raw base64 */
function normalizeBase64(input: string) {
  // data:image/png;base64,XXXXX
  if (/^data:.*;base64,/.test(input)) return input;
  // Nếu chỉ có raw base64 -> thêm prefix PNG mặc định
  return `data:image/png;base64,${input}`;
}

/** Convert response về dạng gọn */
function toUpload(r: UploadApiResponse): CloudinaryUpload {
  return {
    url: r.url,
    secureUrl: r.secure_url,
    publicId: r.public_id,
    width: r.width,
    height: r.height,
    format: r.format,
  };
}

/** ---------- Upload helpers ---------- */

export async function uploadBase64(
  base64: string,
  options: UploadApiOptions = {}
): Promise<CloudinaryUpload> {
  const payload = normalizeBase64(base64);
  const res = await cloudinary.uploader.upload(payload, withDefaults(options));
  return toUpload(res);
}

export async function uploadFromPath(
  filePath: string,
  options: UploadApiOptions = {}
): Promise<CloudinaryUpload> {
  const res = await cloudinary.uploader.upload(filePath, withDefaults(options));
  return toUpload(res);
}

export async function uploadFromBuffer(
  buffer: Buffer,
  filename?: string,
  options: UploadApiOptions = {}
): Promise<CloudinaryUpload> {
  const opts: UploadApiOptions = withDefaults({
    // Nếu muốn sử dụng tên file do mình đặt (không random)
    public_id: filename,
    use_filename: !!filename,
    unique_filename: !filename, // nếu có filename thì không unique
    ...options,
  });

  const res: UploadApiResponse = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (err, result) =>
      err ? reject(err) : resolve(result as UploadApiResponse)
    );
    stream.end(buffer);
  });

  return toUpload(res);
}

/** ---------- Delete helpers ---------- */

export async function deleteByPublicId(publicId: string): Promise<boolean> {
  if (!publicId) return false;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    return true;
  } catch (e) {
    console.warn("[cloudinary] destroy failed:", publicId, e);
    return false;
  }
}

export async function deleteMany(publicIds: string[]): Promise<{ ok: string[]; fail: string[] }> {
  const ok: string[] = [];
  const fail: string[] = [];
  await Promise.all(
    (publicIds || []).map(async (pid) => {
      const done = await deleteByPublicId(pid);
      (done ? ok : fail).push(pid);
    })
  );
  return { ok, fail };
}

/** ---------- Utils ---------- */

/**
 * Trích publicId từ Cloudinary URL.
 * Ví dụ:
 *  https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.jpg -> folder/name
 *  https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v169/folder/sub/name.webp -> folder/sub/name
 */
export function getPublicIdFromUrl(url: string) {
  // bắt phần đứng sau /upload/(v.../)? và trước phần đuôi .ext
  const m = url.match(/\/upload\/(?:v\d+\/)?([^?#]+?)(?:\.[^.\/?#]+)?(?:[?#].*)?$/);
  // nếu không khớp, trả nguyên url (để caller tự quyết)
  return m ? m[1] : url;
}

export default cloudinary;
