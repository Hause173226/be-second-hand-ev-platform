import multer, { FileFilterCallback } from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: process.env.CLOUDINARY_FOLDER || "secondhand-ev/listings",
    resource_type: "image",
  }),
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    const ok = /^image\/(png|jpe?g|webp|gif|heic)$/i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Invalid image type"));
  },
});
