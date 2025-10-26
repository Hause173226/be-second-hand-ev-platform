// ⚠️ ĐÃ BỎ FIREBASE: drop-in thay thế bằng lưu local
import fs from "fs";
import path from "path";

/** Thư mục public để serve static */
const PUBLIC_UPLOAD_DIR = path.join(__dirname, "../../uploads");

/** Đảm bảo thư mục tồn tại */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Chống path traversal, chỉ cho phép lưu trong /uploads */
function toSafeRelativePath(p: string) {
  const norm = path.posix.normalize(p).replace(/^(\.\.[/\\])+/, "");
  // convert backslashes -> forward slashes để làm URL
  return norm.replace(/\\/g, "/");
}

/** Lưu file local, trả về URL tương đối (/uploads/...) */
export async function uploadImageToFirebase(
  file: Express.Multer.File,
  destPath: string,
  _makePublic = true // giữ tham số cho tương thích, không dùng nữa
): Promise<string> {
  // destPath ví dụ: "listings/123/abc.jpg"
  const safeRel = toSafeRelativePath(destPath);
  const absPath = path.join(PUBLIC_UPLOAD_DIR, safeRel);
  const absDir = path.dirname(absPath);

  ensureDir(absDir);

  // Hỗ trợ cả memoryStorage (file.buffer) lẫn diskStorage (file.path)
  const data =
    file.buffer && file.buffer.length > 0
      ? file.buffer
      : file.path
      ? await fs.promises.readFile(file.path)
      : null;

  if (!data) {
    throw new Error("Không tìm thấy dữ liệu file để lưu (buffer/path rỗng).");
  }

  await fs.promises.writeFile(absPath, data);

  // Trả về URL tương đối để client truy cập qua static /uploads
  return `/uploads/${safeRel}`;
}

/** Xoá file local theo đường dẫn đã lưu (ví dụ: "listings/123/abc.jpg") */
export async function deleteImageFromFirebase(destPath: string) {
  try {
    const safeRel = toSafeRelativePath(destPath);
    const absPath = path.join(PUBLIC_UPLOAD_DIR, safeRel);
    await fs.promises.unlink(absPath);
  } catch (err: any) {
    // Bỏ qua nếu không tồn tại
    if (err?.code !== "ENOENT") throw err;
  }
}
