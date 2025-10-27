// src/services/fileUploadService.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Tạo thư mục uploads nếu chưa có
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Cấu hình multer cho file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${crypto.randomUUID()}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Filter file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'text/plain': '.txt',
        'application/zip': '.zip',
        'application/x-rar-compressed': '.rar'
    };

    if (allowedTypes[file.mimetype as keyof typeof allowedTypes]) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5 // Maximum 5 files per request
    }
});

export interface UploadedFile {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    path: string;
    url: string;
}

export class FileUploadService {
    static async processUploadedFiles(files: Express.Multer.File[]): Promise<UploadedFile[]> {
        const processedFiles: UploadedFile[] = [];

        for (const file of files) {
            const fileUrl = `/uploads/${file.filename}`;

            processedFiles.push({
                filename: file.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                path: file.path,
                url: fileUrl
            });
        }

        return processedFiles;
    }

    static async deleteFile(filename: string): Promise<boolean> {
        try {
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }

    static getFileType(mimetype: string): 'image' | 'file' {
        if (mimetype.startsWith('image/')) {
            return 'image';
        }
        return 'file';
    }

    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static async processBase64Image(base64Data: string, fileName: string): Promise<UploadedFile> {
        try {
            // Kiểm tra format base64
            const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
            const match = base64Data.match(base64Regex);

            if (!match) {
                throw new Error('Invalid base64 image format. Only PNG, JPEG, JPG, GIF, and WebP are supported.');
            }

            const mimeType = `image/${match[1]}`;
            const base64String = base64Data.split(',')[1];

            // Validate base64 string
            if (!base64String || base64String.length === 0) {
                throw new Error('Empty base64 data');
            }

            const buffer = Buffer.from(base64String, 'base64');

            // Kiểm tra kích thước file (tối đa 10MB)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (buffer.length > maxSize) {
                throw new Error('Image size exceeds 10MB limit');
            }

            // Kiểm tra kích thước tối thiểu (ít nhất 1KB)
            const minSize = 1024; // 1KB
            if (buffer.length < minSize) {
                throw new Error('Image size too small');
            }

            // Tạo tên file unique
            const uniqueName = `${crypto.randomUUID()}-${Date.now()}-${fileName}`;
            const filePath = path.join(uploadsDir, uniqueName);

            // Lưu file gốc
            fs.writeFileSync(filePath, buffer);

            // Thử compress hình ảnh nếu có sharp
            let finalBuffer = buffer;
            let finalPath = filePath;

            try {
                const sharp = require('sharp');
                const compressedPath = path.join(uploadsDir, `compressed-${uniqueName}`);

                // Resize và compress hình ảnh
                await sharp(buffer)
                    .resize(1920, 1080, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 85 })
                    .png({ quality: 85 })
                    .toFile(compressedPath);

                // Kiểm tra nếu file compressed nhỏ hơn file gốc
                const compressedStats = fs.statSync(compressedPath);
                if (compressedStats.size < buffer.length) {
                    // Xóa file gốc và sử dụng file compressed
                    fs.unlinkSync(filePath);
                    fs.renameSync(compressedPath, filePath);
                    finalBuffer = fs.readFileSync(filePath);
                    console.log(`Image compressed: ${buffer.length} -> ${finalBuffer.length} bytes`);
                } else {
                    // Xóa file compressed nếu không hiệu quả
                    fs.unlinkSync(compressedPath);
                }
            } catch (sharpError) {
                console.log('Sharp not available, using original image');
            }

            // Tạo URL
            const fileUrl = `/uploads/${uniqueName}`;

            return {
                filename: uniqueName,
                originalname: fileName,
                mimetype: mimeType,
                size: finalBuffer.length,
                path: finalPath,
                url: fileUrl
            };
        } catch (error) {
            console.error('Error processing base64 image:', error);
            const errMsg = (error instanceof Error) ? error.message : String(error);
            throw new Error(`Failed to process base64 image: ${errMsg}`);
        }
    }

    static async compressImage(inputPath: string, outputPath: string, quality: number = 80): Promise<void> {
        try {
            // Sử dụng sharp nếu có, nếu không thì giữ nguyên file
            const sharp = require('sharp');

            await sharp(inputPath)
                .jpeg({ quality })
                .png({ quality })
                .toFile(outputPath);
        } catch (error) {
            console.error('Error compressing image:', error);
            // Nếu không có sharp, copy file gốc
            fs.copyFileSync(inputPath, outputPath);
        }
    }
}
