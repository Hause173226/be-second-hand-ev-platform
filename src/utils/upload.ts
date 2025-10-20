import multer from "multer";

const storage = multer.memoryStorage(); // dùng RAM thay vì ghi đĩa

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5MB/ảnh, tối đa 10 ảnh
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error("Chỉ hỗ trợ ảnh PNG/JPG/JPEG/WEBP/GIF"));
  },
});
