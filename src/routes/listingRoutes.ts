// src/routes/listingRoutes.ts
import express, { RequestHandler } from "express";
import { body, param } from "express-validator"; // ⬅️ thêm param
import { authenticate } from "../middlewares/authenticate";
import { optionalAuth } from "../middlewares/optionalAuth";
import { requireProfile } from "../middlewares/requireProfile";
import { validate } from "../middlewares/validate";
import { checkListingLimit } from "../middlewares/checkListingLimit";
import { upload } from "../utils/upload";
import {
  createListing,
  updateListing,
  submitListing,
  myListings,
  getMyListingForEdit,
  priceSuggestionAI,
  searchListings,
  getFilterOptions,
  getListingById,
  // ⬇️ các handler bổ sung
  deleteListing,
  approveListing,
  rejectListing,
  publishListing,
  markSoldListing,
  uploadListingPhotos,
  removeListingPhotos,
  reorderListingPhotos,
} from "../controllers/listingController";

const listingRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Listings
 *     description: API cho người bán tạo/cập nhật/submit tin đăng
 */

/* -------------------------------------------------------------------------- */
/*                                   CREATE                                   */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/listings:
 *   post:
 *     summary: Tạo listing mới (người bán)
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [Car, Battery] }
 *               make: { type: string }
 *               model: { type: string }
 *               year: { type: number }
 *               # Battery-only
 *               batteryCapacityKWh: { type: number }
 *               chargeCycles: { type: number }
 *               # Car-only (theo mẫu hợp đồng)
 *               licensePlate: { type: string, description: "Biển số" }
 *               engineDisplacementCc: { type: number, description: "Dung tích xi lanh (cc)" }
 *               vehicleType: { type: string, description: "Loại xe" }
 *               paintColor: { type: string, description: "Màu sơn" }
 *               engineNumber: { type: string, description: "Số máy" }
 *               chassisNumber: { type: string, description: "Số khung" }
 *               otherFeatures: { type: string, description: "Đặc điểm khác" }
 *               # Chung
 *               mileageKm: { type: number }
 *               condition: { type: string, enum: [New, LikeNew, Used, Worn] }
 *               priceListed: { type: number, minimum: 0 }
 *               tradeMethod: { type: string, enum: [meet, ship, consignment] }
 *               location:
 *                 type: string
 *                 description: JSON string {"city","district","address"}
 *               sellerConfirm:
 *                 type: string
 *                 enum: ["true"]
 *                 description: Cam kết chính chủ
 *               commissionTermsAccepted:
 *                 type: boolean
 *                 description: "Phải là true: Tôi đồng ý Điều khoản & Phí hoa hồng"
 *                 example: true
 *               photos:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: "Cần tối thiểu 3 ảnh"
 *                 minItems: 3
 *     responses:
 *       201: { description: Tạo listing thành công (status=Draft) }
 *       400: { description: Dữ liệu không hợp lệ }
 *       401: { description: Unauthorized }
 *       403: { description: Account not active }
 *       500: { description: Lỗi server }
 */
const createValidators = [
  body("type").isIn(["Car", "Battery"]).withMessage("type phải là Car/Battery"),

  // Chung
  body("priceListed").isFloat({ min: 0 }).withMessage("priceListed ≥ 0"),
  body("tradeMethod")
    .optional()
    .isIn(["meet", "ship", "consignment"])
    .withMessage("tradeMethod phải là meet/ship/consignment"),
  body("condition").optional().isIn(["New", "LikeNew", "Used", "Worn"]),
  body("year").optional().isInt({ min: 1900 }),
  body("mileageKm").optional().isFloat({ min: 0 }),

  // Battery-only (optional)
  body("batteryCapacityKWh").optional().isFloat({ min: 0 }),
  body("chargeCycles").optional().isInt({ min: 0 }),

  // Car-only (optional)
  body("licensePlate")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage("licensePlate không hợp lệ"),
  body("engineDisplacementCc").optional().isFloat({ min: 0 }),
  body("vehicleType").optional().isString().trim(),
  body("paintColor").optional().isString().trim(),
  body("engineNumber").optional().isString().trim(),
  body("chassisNumber").optional().isString().trim(),
  body("otherFeatures").optional().isString().trim(),

  // Cam kết chính chủ
  body("sellerConfirm")
    .custom((v) => v === "true")
    .withMessage("sellerConfirm phải là 'true'"),

  // location JSON
  body("location")
    .custom((v) => {
      try {
        const o = typeof v === "string" ? JSON.parse(v) : v;
        return !!(o?.city && o?.district && o?.address);
      } catch {
        return false;
      }
    })
    .withMessage("location phải là JSON hợp lệ và có city/district/address"),

  // bắt buộc đồng ý điều khoản & phí hoa hồng
  body("commissionTermsAccepted")
    .custom((v) => {
      if (typeof v === "boolean") return v === true;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        return s === "true" || s === "1" || s === "yes" || s === "on";
      }
      return false;
    })
    .withMessage(
      "Bạn phải đồng ý Điều khoản & Phí hoa hồng (commissionTermsAccepted=true)."
    ),
];

listingRoutes.post(
  "/",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  checkListingLimit as RequestHandler,
  upload.array("photos", 10),
  ...createValidators,
  validate as RequestHandler,
  createListing as unknown as RequestHandler
);

/* -------------------------------------------------------------------------- */
/*                                   UPDATE                                   */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/listings/{id}:
 *   patch:
 *     summary: Cập nhật listing (chỉ khi Draft/Rejected)
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [Car, Battery] }
 *               make: { type: string }
 *               model: { type: string }
 *               year: { type: number }
 *               # Battery-only
 *               batteryCapacityKWh: { type: number }
 *               chargeCycles: { type: number }
 *               # Car-only
 *               licensePlate: { type: string }
 *               engineDisplacementCc: { type: number }
 *               vehicleType: { type: string }
 *               paintColor: { type: string }
 *               engineNumber: { type: string }
 *               chassisNumber: { type: string }
 *               otherFeatures: { type: string }
 *               # Chung
 *               mileageKm: { type: number }
 *               condition: { type: string, enum: [New, LikeNew, Used, Worn] }
 *               priceListed: { type: number, minimum: 0 }
 *               tradeMethod: { type: string, enum: [meet, ship, consignment] }
 *               location:
 *                 type: string
 *                 description: JSON string {"city","district","address"}
 *               photos:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200: { description: Cập nhật thành công }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (không phải chủ sở hữu) }
 *       404: { description: Not found }
 *       409: { description: Không thể sửa khi trạng thái hiện tại không hợp lệ }
 */
const updateValidators = [
  body("type").optional().isIn(["Car", "Battery"]),
  body("priceListed").optional().isFloat({ min: 0 }),
  body("tradeMethod")
    .optional()
    .isIn(["meet", "ship", "consignment"])
    .withMessage("tradeMethod phải là meet/ship/consignment"),
  body("condition").optional().isIn(["New", "LikeNew", "Used", "Worn"]),
  body("year").optional().isInt({ min: 1900 }),
  body("mileageKm").optional().isFloat({ min: 0 }),

  // Battery-only (optional)
  body("batteryCapacityKWh").optional().isFloat({ min: 0 }),
  body("chargeCycles").optional().isInt({ min: 0 }),

  // Car-only (optional)
  body("licensePlate").optional().isString().trim().isLength({ min: 1 }),
  body("engineDisplacementCc").optional().isFloat({ min: 0 }),
  body("vehicleType").optional().isString().trim(),
  body("paintColor").optional().isString().trim(),
  body("engineNumber").optional().isString().trim(),
  body("chassisNumber").optional().isString().trim(),
  body("otherFeatures").optional().isString().trim(),

  body("location")
    .optional()
    .custom((v) => {
      if (v == null) return true;
      try {
        const o = typeof v === "string" ? JSON.parse(v) : v;
        return !!(o?.city && o?.district && o?.address);
      } catch {
        return false;
      }
    }),
];

listingRoutes.patch(
  "/:id",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  upload.array("photos", 10),
  ...updateValidators,
  validate as RequestHandler,
  updateListing as unknown as RequestHandler
);

/**
 * @swagger
 * /api/listings/{id}/json:
 *   patch:
 *     summary: Cập nhật listing (Draft/Rejected) - JSON only (không ảnh)
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Listing'
 *     responses:
 *       200: { description: Cập nhật thành công }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       409: { description: Trạng thái không hợp lệ }
 */
listingRoutes.patch(
  "/:id/json",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  upload.none(),
  ...updateValidators,
  validate as RequestHandler,
  updateListing as unknown as RequestHandler
);

/* -------------------------------------------------------------------------- */
/*                                   SUBMIT                                   */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/listings/{id}/submit:
 *   post:
 *     summary: Submit listing để duyệt (Draft/Rejected → PendingReview)
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commissionTermsAccepted:
 *                 type: boolean
 *                 description: "Phải là true: tôi đồng ý Điều khoản & Phí hoa hồng"
 *                 example: true
 *     responses:
 *       200: { description: Submit thành công → PendingReview }
 *       400: { description: Auto moderation failed / thiếu dữ liệu bắt buộc }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       409: { description: Trạng thái hiện tại không hợp lệ }
 */
const submitValidators = [
  body("commissionTermsAccepted")
    .optional()
    .custom((v) => {
      if (typeof v === "boolean") return v === true;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        return s === "true" || s === "1" || s === "yes" || s === "on";
      }
      return false;
    })
    .withMessage("commissionTermsAccepted, nếu gửi, phải là true."),
];

listingRoutes.post(
  "/:id/submit",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  ...submitValidators,
  validate as RequestHandler,
  submitListing as unknown as RequestHandler
);

/* -------------------------------------------------------------------------- */
/*                                 MY LISTINGS                                */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/listings/mine:
 *   get:
 *     summary: Lấy danh sách listing của tôi
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Danh sách listing của user hiện tại }
 *       401: { description: Unauthorized }
 */
listingRoutes.get(
  "/mine",
  authenticate as RequestHandler,
  myListings as unknown as RequestHandler
);

/**
 * @swagger
 * /api/listings/mine/{id}:
 *   get:
 *     summary: Lấy chi tiết listing của tôi (Draft/Rejected) để prefill khi chỉnh sửa
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Chi tiết listing của chính chủ }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (không phải chủ) }
 *       404: { description: Not found }
 */
listingRoutes.get(
  "/mine/:id",
  authenticate as RequestHandler,
  getMyListingForEdit as unknown as RequestHandler
);

/* -------------------------------------------------------------------------- */
/*                                PRICE SUGGEST                               */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/listings/price-suggest:
 *   post:
 *     summary: Gợi ý giá (tạm thời dùng heuristic)
 *     description: Body là JSON, KHÔNG phải multipart.
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [Car, Battery] }
 *               make: { type: string }
 *               model: { type: string }
 *               year: { type: number }
 *               mileageKm: { type: number }
 *               batteryCapacityKWh: { type: number }
 *               condition: { type: string, enum: [New, LikeNew, Used, Worn] }
 *     responses:
 *       200:
 *         description: Giá gợi ý thành công (heuristic)
 *       401: { description: Unauthorized }
 *       500: { description: Lỗi server }
 */
listingRoutes.post(
  "/price-suggest",
  authenticate as RequestHandler,
  validate as RequestHandler,
  priceSuggestionAI as unknown as RequestHandler
);

/* -------------------------------------------------------------------------- */
/*                               PUBLIC SEARCH                                */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/listings:
 *   get:
 *     summary: Tìm kiếm và lọc sản phẩm đã được duyệt
 *     description: |
 *       API công khai để tìm kiếm sản phẩm với các bộ lọc và phân trang.
 *       Tự động lưu lịch sử tìm kiếm nếu user đã đăng nhập và có keyword.
 *     tags: [Listings]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm (hãng, model, ghi chú)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [Car, Battery]
 *         description: Loại sản phẩm (Xe hoặc Pin)
 *       - in: query
 *         name: make
 *         schema:
 *           type: string
 *         description: Hãng xe
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Model xe
 *       - in: query
 *         name: year
 *         schema:
 *           type: number
 *         description: Năm sản xuất
 *       - in: query
 *         name: batteryCapacityKWh
 *         schema:
 *           type: number
 *         description: Dung lượng pin (kWh) — áp dụng bản ghi Battery
 *       - in: query
 *         name: mileageKm
 *         schema:
 *           type: number
 *         description: Số km đã chạy (tối đa)
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Giá tối thiểu
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Giá tối đa
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Thành phố
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         description: Quận/huyện
 *       - in: query
 *         name: condition
 *         schema:
 *           type: string
 *           enum: [New, LikeNew, Used, Worn]
 *         description: Tình trạng xe
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Published, InTransaction, Sold, Draft, PendingReview]
 *         description: Trạng thái sản phẩm (không truyền = hiển thị tất cả)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest, price_low, price_high, reputation]
 *           default: newest
 *         description: Sắp xếp theo
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 12
 *         description: Số sản phẩm mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm với thông tin phân trang
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 listings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Listing'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *                     totalCount:
 *                       type: number
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *                     limit:
 *                       type: number
 *                 filters:
 *                   type: object
 *                   description: Các filter đã áp dụng
 */
listingRoutes.get(
  "/",
  optionalAuth as RequestHandler,
  searchListings as unknown as RequestHandler
);

/**
 * @swagger
 * /api/listings/filter-options:
 *   get:
 *     summary: Lấy danh sách các giá trị filter có sẵn
 *     description: API để lấy các giá trị có thể chọn cho dropdown filter
 *     tags: [Listings]
 *     responses:
 *       200:
 *         description: Danh sách các giá trị filter
 */
listingRoutes.get(
  "/filter-options",
  getFilterOptions as unknown as RequestHandler
);

/* -------------------------------------------------------------------------- */
/*                                PUBLIC DETAIL                               */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/listings/{id}:
 *   get:
 *     summary: Lấy chi tiết sản phẩm theo ID
 *     description: API công khai để xem chi tiết một sản phẩm đã được duyệt
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: ID của sản phẩm (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Chi tiết sản phẩm
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Sản phẩm không tồn tại hoặc chưa được duyệt
 */
listingRoutes.get("/:id", getListingById as unknown as RequestHandler);

/* -------------------------------------------------------------------------- */
/*                               PHOTO MANAGEMENT                             */
/* -------------------------------------------------------------------------- */

// Upload thêm ảnh cho listing (Draft/Rejected)
// body: photos[] (multipart)
listingRoutes.post(
  "/:id/photos",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  upload.array("photos", 10),
  param("id").isString().isLength({ min: 1 }),
  validate as RequestHandler,
  uploadListingPhotos as unknown as RequestHandler
);

// Xoá 1 ảnh theo publicId
listingRoutes.delete(
  "/:id/photos/:publicId",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  param("id").isString().isLength({ min: 1 }),
  param("publicId").isString().isLength({ min: 1 }),
  validate as RequestHandler,
  removeListingPhotos as unknown as RequestHandler
);

// Sắp xếp lại thứ tự ảnh
// body: { order: string[] } (mảng publicId theo thứ tự mới)
listingRoutes.post(
  "/:id/photos/reorder",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  param("id").isString().isLength({ min: 1 }),
  body("order")
    .custom((v) => Array.isArray(v) && v.every((x) => typeof x === "string"))
    .withMessage("order phải là mảng publicId (string)"),
  validate as RequestHandler,
  reorderListingPhotos as unknown as RequestHandler
);

/* -------------------------------------------------------------------------- */
/*                               STATUS / ADMIN                               */
/* -------------------------------------------------------------------------- */

// Approve → Published (hoặc chờ publish)
// body: { note?: string }
listingRoutes.post(
  "/:id/approve",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  param("id").isString().isLength({ min: 1 }),
  validate as RequestHandler,
  approveListing as unknown as RequestHandler
);

// Reject với lý do
// body: { reason: string }
listingRoutes.post(
  "/:id/reject",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  param("id").isString().isLength({ min: 1 }),
  body("reason").isString().trim().isLength({ min: 3 }),
  validate as RequestHandler,
  rejectListing as unknown as RequestHandler
);

// Publish thủ công (nếu cần)
listingRoutes.post(
  "/:id/publish",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  param("id").isString().isLength({ min: 1 }),
  validate as RequestHandler,
  publishListing as unknown as RequestHandler
);

// Đánh dấu đã bán
listingRoutes.post(
  "/:id/mark-sold",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  param("id").isString().isLength({ min: 1 }),
  validate as RequestHandler,
  markSoldListing as unknown as RequestHandler
);

/* -------------------------------------------------------------------------- */
/*                                    DELETE                                  */
/* -------------------------------------------------------------------------- */

// Xoá listing (chủ sở hữu, chỉ Draft/Rejected)
listingRoutes.delete(
  "/:id",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  param("id").isString().isLength({ min: 1 }),
  validate as RequestHandler,
  deleteListing as unknown as RequestHandler
);

export default listingRoutes;
