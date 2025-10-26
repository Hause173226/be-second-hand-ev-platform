// src/routes/listingRoutes.ts
import express, { RequestHandler } from "express";
import { body } from "express-validator";
import { authenticate } from "../middlewares/authenticate";
import { optionalAuth } from "../middlewares/optionalAuth";
import { requireProfile } from "../middlewares/requireProfile";
import { validate } from "../middlewares/validate";
import { upload } from "../utils/upload";
import {
  createListing,
  updateListing,
  submitListing,
  myListings,
  priceSuggestionAI,
  searchListings,
  getFilterOptions,
  getListingById,
} from "../controllers/listingController";

const listingRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Listings
 *     description: API cho người bán tạo/cập nhật/submit tin đăng
 */

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
 *               batteryCapacityKWh: { type: number }
 *               mileageKm: { type: number }
 *               chargeCycles: { type: number }
 *               condition: { type: string, enum: [New, LikeNew, Used, Worn] }
 *               priceListed: { type: number, minimum: 0 }           # (15)
 *               tradeMethod: { type: string, enum: [meet, ship, consignment] }  # (15)
 *               location:
 *                 type: string
 *                 description: JSON string {"city","district","address"}        # (15) bỏ lat/lng
 *               sellerConfirm:
 *                 type: string
 *                 enum: ["true"]
 *                 description: Cam kết chính chủ
 *               commissionTermsAccepted:                                  # ✅ NEW: BẮT BUỘC
 *                 type: boolean
 *                 description: "Phải là true: Tôi đồng ý Điều khoản & Phí hoa hồng"
 *                 example: true
 *               photos:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201: { description: Tạo listing thành công (status=Draft) }
 *       400: { description: Dữ liệu không hợp lệ }
 *       401: { description: Unauthorized }
 *       403: { description: Account not active }
 *       500: { description: Lỗi server }
 */
const createValidators = [
  body("type").isIn(["Car", "Battery"]).withMessage("type phải là Car/Battery"),
  body("priceListed").isFloat({ min: 0 }).withMessage("priceListed ≥ 0"), // (15)
  body("tradeMethod") // (15)
    .optional()
    .isIn(["meet", "ship", "consignment"])
    .withMessage("tradeMethod phải là meet/ship/consignment"),
  // tránh .equals(...) gây lỗi TS; custom check 'true'
  body("sellerConfirm")
    .custom((v) => v === "true")
    .withMessage("sellerConfirm phải là 'true'"),
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
  // ✅ NEW: bắt buộc đồng ý điều khoản & phí hoa hồng
  body("commissionTermsAccepted")
    .custom((v) => {
      if (typeof v === "boolean") return v === true;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        return s === "true" || s === "1" || s === "yes" || s === "on";
      }
      return false;
    })
    .withMessage("Bạn phải đồng ý Điều khoản & Phí hoa hồng (commissionTermsAccepted=true)."),
];

listingRoutes.post(
  "/",
  authenticate as RequestHandler,
  requireProfile as RequestHandler,
  upload.array("photos", 10),
  ...createValidators,
  validate as RequestHandler,
  createListing as unknown as RequestHandler
);

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
 *         multipart/form-data:               # 👈 đổi sang multipart để nhận ảnh
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [Car, Battery] }
 *               make: { type: string }
 *               model: { type: string }
 *               year: { type: number }
 *               batteryCapacityKWh: { type: number }
 *               mileageKm: { type: number }
 *               chargeCycles: { type: number }
 *               condition: { type: string, enum: [New, LikeNew, Used, Worn] }
 *               priceListed: { type: number, minimum: 0 }                # (15)
 *               tradeMethod: { type: string, enum: [meet, ship, consignment] } # (15)
 *               location:
 *                 type: string
 *                 description: JSON string {"city","district","address"}  # gửi dạng text như POST
 *               photos:
 *                 type: array
 *                 items: { type: string, format: binary }                 # ảnh mới (nếu có)
 *     responses:
 *       200: { description: Cập nhật thành công }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (không phải chủ sở hữu) }
 *       404: { description: Not found }
 *       409: { description: Không thể sửa khi trạng thái hiện tại không hợp lệ }
 */
const updateValidators = [
  body("type").optional().isIn(["Car", "Battery"]),
  body("priceListed").optional().isFloat({ min: 0 }), // (15)
  body("tradeMethod") // (15)
    .optional()
    .isIn(["meet", "ship", "consignment"])
    .withMessage("tradeMethod phải là meet/ship/consignment"),
  body("condition").optional().isIn(["New", "LikeNew", "Used", "Worn"]),
  body("year").optional().isInt({ min: 1900 }),
  body("batteryCapacityKWh").optional().isFloat({ min: 0 }),
  body("mileageKm").optional().isFloat({ min: 0 }),
  body("chargeCycles").optional().isInt({ min: 0 }),
  body("location")
    .optional()
    .custom((v) => {
      if (v == null) return true;
      // Vì PATCH giờ là multipart, location tới đây là string JSON
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
  upload.array("photos", 10),             // 👈 thêm để nhận ảnh (multipart)
  ...updateValidators,
  validate as RequestHandler,
  updateListing as unknown as RequestHandler
);

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
 *               commissionTermsAccepted:                  # ✅ NEW (nhắc lại khi submit, phòng lách)
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
  // Không bắt buộc gửi, nhưng nếu có thì phải là true
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
  validate as RequestHandler, // để đồng nhất pipeline
  priceSuggestionAI as unknown as RequestHandler
);

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
 *         description: Dung lượng pin (kWh)
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
listingRoutes.get("/", optionalAuth as RequestHandler, searchListings as unknown as RequestHandler);

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 makes:
 *                   type: array
 *                   items:
 *                     type: string
 *                 models:
 *                   type: array
 *                   items:
 *                     type: string
 *                 years:
 *                   type: array
 *                   items:
 *                     type: number
 *                 batteryCapacities:
 *                   type: array
 *                   items:
 *                     type: number
 *                 conditions:
 *                   type: array
 *                   items:
 *                     type: string
 *                 cities:
 *                   type: array
 *                   items:
 *                     type: string
 *                 districts:
 *                   type: array
 *                   items:
 *                     type: string
 *                 priceRange:
 *                   type: object
 *                   properties:
 *                     min:
 *                       type: number
 *                     max:
 *                       type: number
 */
listingRoutes.get("/filter-options", getFilterOptions as unknown as RequestHandler);

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
 *       400:
 *         description: ID không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ID không hợp lệ"
 *       404:
 *         description: Sản phẩm không tồn tại hoặc chưa được duyệt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sản phẩm không tồn tại hoặc chưa được duyệt"
 */

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
 *       400:
 *         description: ID không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ID không hợp lệ"
 *       404:
 *         description: Sản phẩm không tồn tại hoặc chưa được duyệt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sản phẩm không tồn tại hoặc chưa được duyệt"
 */
listingRoutes.get("/:id", getListingById as unknown as RequestHandler);

export default listingRoutes;
