// src/routes/searchHistoryRoutes.ts
import express, { RequestHandler } from "express";
import { body } from "express-validator";
import { authenticateJWT } from "../middlewares/authenticate";
import { validate } from "../middlewares/validate";
import {
    saveSearchHistory,
    getUserSearchHistory,
    clearUserSearchHistory,
    deleteSearchHistoryItem,
    getPopularSearchHistory,
    getSearchSuggestions,
    getSearchStats,
} from "../controllers/searchHistoryController";

const searchHistoryRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Search History
 *     description: API quản lý lịch sử tìm kiếm của người dùng
 */

/**
 * @swagger
 * /api/search/history/save:
 *   post:
 *     summary: Lưu lịch sử tìm kiếm
 *     description: Lưu lịch sử tìm kiếm của người dùng
 *     tags: [Search History]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - searchQuery
 *             properties:
 *               searchQuery:
 *                 type: string
 *                 description: Từ khóa tìm kiếm
 *                 example: "Tesla Model 3"
 *               searchType:
 *                 type: string
 *                 enum: [listing, user, general]
 *                 default: listing
 *                 description: Loại tìm kiếm
 *               filters:
 *                 type: object
 *                 description: Các bộ lọc đã áp dụng
 *                 properties:
 *                   make:
 *                     type: string
 *                   model:
 *                     type: string
 *                   year:
 *                     type: number
 *                   minPrice:
 *                     type: number
 *                   maxPrice:
 *                     type: number
 *                   city:
 *                     type: string
 *               resultsCount:
 *                 type: number
 *                 description: Số lượng kết quả tìm được
 *                 example: 15
 *     responses:
 *       201:
 *         description: Lưu lịch sử thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SearchHistory'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 */
const saveValidators = [
    body("searchQuery")
        .notEmpty()
        .withMessage("searchQuery là bắt buộc")
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("searchQuery phải từ 1-200 ký tự"),
    body("searchType")
        .optional()
        .isIn(["listing", "user", "general"])
        .withMessage("searchType phải là listing/user/general"),
    body("resultsCount")
        .optional()
        .isInt({ min: 0 })
        .withMessage("resultsCount phải là số nguyên >= 0")
];

searchHistoryRoutes.post(
    "/history/save",
    authenticateJWT as RequestHandler,
    ...saveValidators,
    validate as RequestHandler,
    saveSearchHistory as unknown as RequestHandler
);

/**
 * @swagger
 * /api/search/history:
 *   get:
 *     summary: Lấy lịch sử tìm kiếm của user
 *     description: Lấy danh sách lịch sử tìm kiếm của người dùng hiện tại
 *     tags: [Search History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Số lượng kết quả trả về
 *       - in: query
 *         name: searchType
 *         schema:
 *           type: string
 *           enum: [listing, user, general]
 *         description: Lọc theo loại tìm kiếm
 *     responses:
 *       200:
 *         description: Danh sách lịch sử tìm kiếm
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SearchHistory'
 *                 count:
 *                   type: number
 *       401:
 *         description: Unauthorized
 */
searchHistoryRoutes.get(
    "/history",
    authenticateJWT as RequestHandler,
    getUserSearchHistory as unknown as RequestHandler
);

/**
 * @swagger
 * /api/search/history/clear:
 *   delete:
 *     summary: Xóa tất cả lịch sử tìm kiếm của user
 *     description: Xóa toàn bộ lịch sử tìm kiếm của người dùng hiện tại
 *     tags: [Search History]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Xóa thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: number
 *       401:
 *         description: Unauthorized
 */
searchHistoryRoutes.delete(
    "/history/clear",
    authenticateJWT as RequestHandler,
    clearUserSearchHistory as unknown as RequestHandler
);

/**
 * @swagger
 * /api/search/history/{id}:
 *   delete:
 *     summary: Xóa một lịch sử tìm kiếm cụ thể
 *     description: Xóa một mục lịch sử tìm kiếm cụ thể của người dùng
 *     tags: [Search History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch sử tìm kiếm
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Không tìm thấy lịch sử tìm kiếm
 */
searchHistoryRoutes.delete(
    "/history/:id",
    authenticateJWT as RequestHandler,
    deleteSearchHistoryItem as unknown as RequestHandler
);

/**
 * @swagger
 * /api/search/popular:
 *   get:
 *     summary: Lấy lịch sử tìm kiếm phổ biến
 *     description: Lấy danh sách các từ khóa tìm kiếm phổ biến nhất
 *     tags: [Search History]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Số lượng kết quả trả về
 *       - in: query
 *         name: searchType
 *         schema:
 *           type: string
 *           enum: [listing, user, general]
 *           default: listing
 *         description: Lọc theo loại tìm kiếm
 *     responses:
 *       200:
 *         description: Danh sách tìm kiếm phổ biến
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       query:
 *                         type: string
 *                       count:
 *                         type: number
 *                       lastSearched:
 *                         type: string
 *                         format: date-time
 *                       avgResultsCount:
 *                         type: number
 *                       category:
 *                         type: string
 *                         enum: [popular, trending, recent]
 *                 count:
 *                   type: number
 */
searchHistoryRoutes.get(
    "/popular",
    getPopularSearchHistory as unknown as RequestHandler
);

/**
 * @swagger
 * /api/search/suggestions:
 *   get:
 *     summary: Lấy gợi ý tìm kiếm
 *     description: Lấy gợi ý tìm kiếm dựa trên từ khóa
 *     tags: [Search History]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 *         description: Từ khóa để tìm gợi ý
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Số lượng gợi ý trả về
 *     responses:
 *       200:
 *         description: Danh sách gợi ý tìm kiếm
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       query:
 *                         type: string
 *                       count:
 *                         type: number
 *                       lastSearched:
 *                         type: string
 *                         format: date-time
 *                 count:
 *                   type: number
 *       400:
 *         description: Thiếu từ khóa
 */
searchHistoryRoutes.get(
    "/suggestions",
    getSearchSuggestions as unknown as RequestHandler
);

/**
 * @swagger
 * /api/search/stats:
 *   get:
 *     summary: Lấy thống kê tìm kiếm của user
 *     description: Lấy thống kê về hoạt động tìm kiếm của người dùng
 *     tags: [Search History]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê tìm kiếm
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSearches:
 *                       type: number
 *                     successfulSearches:
 *                       type: number
 *                     successRate:
 *                       type: number
 *                     averageResults:
 *                       type: number
 *                     uniqueQueryCount:
 *                       type: number
 *       401:
 *         description: Unauthorized
 */
searchHistoryRoutes.get(
    "/stats",
    authenticateJWT as RequestHandler,
    getSearchStats as unknown as RequestHandler
);

export default searchHistoryRoutes;
