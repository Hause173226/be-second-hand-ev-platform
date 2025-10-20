import { bucket } from "../utils/firebaseAdmin";

/** Upload 1 ảnh lên Firebase Storage, trả về public URL hoặc signed URL */
export async function uploadImageToFirebase(
  file: Express.Multer.File,
  destPath: string,
  makePublic = true
): Promise<string> {
  const gcsFile = bucket.file(destPath);

  await gcsFile.save(file.buffer, {
    resumable: false,
    contentType: file.mimetype,
    metadata: {
      contentType: file.mimetype,
      cacheControl: "public, max-age=31536000",
    },
  });

  if (makePublic) {
    await gcsFile.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(destPath)}`;
  }

  const [signedUrl] = await gcsFile.getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 ngày
  });
  return signedUrl;
}

/** Xoá ảnh theo đường dẫn trong bucket (nếu cần) */
export async function deleteImageFromFirebase(destPath: string) {
  try {
    await bucket.file(destPath).delete({ ignoreNotFound: true });
  } catch {}
}
