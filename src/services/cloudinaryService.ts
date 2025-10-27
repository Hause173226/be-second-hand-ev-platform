import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export type CloudinaryUpload = {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
};

const DEFAULT_FOLDER = process.env.CLOUDINARY_FOLDER || "secondhand-ev/listings";

export async function uploadBase64(
  base64: string,
  options: UploadApiOptions = {}
): Promise<CloudinaryUpload> {
  const res = await cloudinary.uploader.upload(base64, {
    folder: DEFAULT_FOLDER,
    resource_type: "image",
    ...options,
  });
  return toUpload(res);
}

export async function uploadFromPath(
  filePath: string,
  options: UploadApiOptions = {}
): Promise<CloudinaryUpload> {
  const res = await cloudinary.uploader.upload(filePath, {
    folder: DEFAULT_FOLDER,
    resource_type: "image",
    ...options,
  });
  return toUpload(res);
}

export async function uploadFromBuffer(
  buffer: Buffer,
  filename?: string,
  options: UploadApiOptions = {}
): Promise<CloudinaryUpload> {
  // Dùng upload_stream để tránh ghi file tạm
  const res: UploadApiResponse = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: DEFAULT_FOLDER, resource_type: "image", public_id: filename, ...options },
      (err, result) => (err ? reject(err) : resolve(result as UploadApiResponse))
    );
    stream.end(buffer);
  });
  return toUpload(res);
}

export async function deleteByPublicId(publicId: string) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

export function getPublicIdFromUrl(url: string) {
  // https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.jpg => folder/name
  const parts = url.split("/");
  const file = parts.pop()!; // name.jpg
  const folder = parts.slice(parts.indexOf("upload") + 1).join("/"); // v123/folder
  const noVer = folder.replace(/^v\d+\//, ""); // remove v123
  const publicId = noVer + "/" + file.replace(/\.[^.]+$/, "");
  return publicId;
}

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

export default cloudinary;
