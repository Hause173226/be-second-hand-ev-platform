// src/utils/upload.ts (hoặc src/services/upload.ts)
import multer, { FileFilterCallback } from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";

/** ---- Init Cloudinary (có guard) ---- */
const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER,
} = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn(
    "[upload] Missing Cloudinary envs. Please set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET"
  );
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const DEFAULT_FOLDER = CLOUDINARY_FOLDER || "secondhand-ev/listings";

/** ---- Storage config ----
 * - Convert HEIC/HEIF → JPG
 * - unique_filename: true để tránh đè file
 * - transformation: auto format & quality
 */
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
    const isHeic = /image\/hei(c|f)/i.test(file.mimetype);
    return {
      folder: DEFAULT_FOLDER,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"],
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      // Nếu là HEIC/HEIF thì convert sang JPG để hiển thị web tốt hơn
      ...(isHeic ? { format: "jpg" } : {}),
      transformation: [{ fetch_format: "auto", quality: "auto" }],
    };
  },
});

/** ---- Multer instance ---- */
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB/ảnh
    files: 20, // tuỳ nhu cầu
  },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    const ok =
      /^image\/(png|jpe?g|webp|gif|heic|heif)$/i.test(file.mimetype) ||
      // một số trình duyệt/thiết bị gửi sai mimetype → fallback theo đuôi
      /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error("Invalid image type"));
  },
});

/** ---- Helpers cho route ---- */
export const uploadSinglePhoto = upload.single("photo");
export const uploadPhotos = upload.array("photos", 10);
export const uploadMixed = upload.fields([
  { name: "photos", maxCount: 10 },
  { name: "documents", maxCount: 10 },
]);

/** ---- Type tiện dụng khi đọc file sau khi upload ----
 * Multer-Cloudinary gắn:
 *  - file.path     = secure_url
 *  - file.filename = public_id
 */
export type MulterCloudinaryFile = Express.Multer.File & {
  path: string; // Cloudinary secure_url
  filename: string; // Cloudinary public_id
};
