// src/routes/appointmentRoutes.ts
import express, { RequestHandler } from "express";
import {
    createAppointment,
    createAppointmentFromChat,
    getUserAppointments,
    confirmAppointment,
    rejectAppointment,
    rescheduleAppointment,
    cancelAppointment,
    getAppointmentDetails,
    getStaffAppointments,
    createAppointmentFromAuction,
    getAuctionAppointments,
    getAppointmentByChatId,
    completeAppointment,
    requestNotarizationAppointment,
    selectAppointmentSlot,
    declineNotarizationAppointment,
    uploadNotarizationProof,
    requestHandoverAppointment,
    uploadHandoverProof,
} from "../controllers/appointmentController";
import {
    createDeposit,
    createFullPayment,
    createRemainingPayment,
    getAppointmentTimeline,
} from "../controllers/appointmentDepositController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/role";
import multer from "multer";

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10,
    },
    fileFilter: (_req, file, cb) => {
        const ok =
            /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype) ||
            /\.(png|jpe?g|webp|gif)$/i.test(file.originalname);
        if (ok) cb(null, true);
        else cb(new Error("Invalid image type"));
    },
});

// Router cho các API endpoints liên quan đến appointments và lịch hẹn
const router = express.Router();

/**
 * @swagger
 * /api/appointments/chat:
 *   post:
 *     summary: Tạo lịch hẹn xem xe trực tiếp từ chat
 *     description: Cho phép buyer hoặc seller đặt lịch xem xe trước khi đặt cọc, dựa trên một cuộc trò chuyện cụ thể.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *             properties:
 *               chatId:
 *                 type: string
 *                 description: ID của cuộc trò chuyện
 *                 example: "676c1234567890abcdef1234"
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: Ngày giờ mong muốn (mặc định +3 ngày nếu không cung cấp)
 *                 example: "2025-11-05T09:00:00Z"
 *               location:
 *                 type: string
 *                 description: Địa điểm dự kiến
 *                 example: "Showroom EV - 123 Hai Bà Trưng"
 *               notes:
 *                 type: string
 *                 description: Ghi chú thêm cho cuộc hẹn
 *                 example: "Mang theo giấy tờ xe gốc"
 *     responses:
 *       201:
 *         description: Tạo lịch hẹn thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Đã tạo lịch hẹn xem xe thành công"
 *                 appointment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     chatId:
 *                       type: string
 *                     scheduledDate:
 *                       type: string
 *                       format: date-time
 *                     location:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "PENDING"
 *                     type:
 *                       type: string
 *                       example: "VEHICLE_INSPECTION"
 *       400:
 *         description: Thiếu chatId hoặc dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Người dùng không thuộc cuộc trò chuyện này
 *       404:
 *         description: Không tìm thấy chat
 *       500:
 *         description: Lỗi server
 */
router.post('/chat', authenticate, createAppointmentFromChat as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/chat/{chatId}:
 *   get:
 *     summary: Lấy appointment active của một chat (nếu có)
 *     description: Kiểm tra xem chat này đã có lịch hẹn đang hoạt động (PENDING/CONFIRMED/RESCHEDULED) chưa
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của cuộc trò chuyện
 *         example: "691adf246fe28d87f725acdc"
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 hasActiveAppointment:
 *                   type: boolean
 *                   description: Có appointment active hay không
 *                   example: true
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   description: Appointment object nếu có, null nếu không có
 *                   $ref: '#/components/schemas/Appointment'
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền xem appointment của chat này
 *       500:
 *         description: Lỗi server
 */
router.get('/chat/:chatId', authenticate, getAppointmentByChatId as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Tạo lịch hẹn mới sau khi đặt cọc
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - depositRequestId
 *             properties:
 *               depositRequestId:
 *                 type: string
 *                 description: ID của yêu cầu đặt cọc
 *                 example: "673c1234567890abcdef1234"
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: Ngày giờ hẹn (mặc định 7 ngày sau nếu không cung cấp)
 *                 example: "2025-10-30T10:00:00Z"
 *               location:
 *                 type: string
 *                 description: Địa điểm gặp mặt
 *                 example: "123 Đường ABC, Quận 1, TP.HCM"
 *               notes:
 *                 type: string
 *                 description: Ghi chú thêm
 *                 example: "Mang theo CMND và bằng lái xe"
 *     responses:
 *       200:
 *         description: Tạo lịch hẹn thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Đã tạo lịch hẹn ký hợp đồng"
 *                 appointment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     scheduledDate:
 *                       type: string
 *                       format: date-time
 *                     location:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "PENDING"
 *                     type:
 *                       type: string
 *                       example: "CONTRACT_SIGNING"
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.post('/', authenticate, createAppointment as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/{appointmentId}/confirm:
 *   post:
 *     summary: Xác nhận lịch hẹn (Buyer hoặc Seller)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch hẹn
 *         example: "673c1234567890abcdef1234"
 *     responses:
 *       200:
 *         description: Xác nhận thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Xác nhận lịch hẹn thành công - Cả hai bên đã xác nhận"
 *                 appointment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     scheduledDate:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       example: "CONFIRMED"
 *                     buyerConfirmed:
 *                       type: boolean
 *                       example: true
 *                     sellerConfirmed:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền xác nhận
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *       500:
 *         description: Lỗi server
 */
router.post('/:appointmentId/confirm', authenticate, confirmAppointment as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/{appointmentId}/reject:
 *   post:
 *     summary: Từ chối lịch hẹn và tự động dời sang 1 tuần sau
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch hẹn
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do từ chối
 *                 example: "Không phù hợp thời gian"
 *     responses:
 *       200:
 *         description: Từ chối thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Đã từ chối lịch hẹn. Hệ thống đã tự động dời lịch 1 tuần và gửi thông báo cho cả hai bên."
 *                 appointment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     scheduledDate:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       example: "RESCHEDULED"
 *                     rescheduledCount:
 *                       type: number
 *                       example: 1
 *                     buyerConfirmed:
 *                       type: boolean
 *                       example: false
 *                     sellerConfirmed:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Không thể từ chối lịch hẹn đã hoàn thành hoặc đã hủy
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền từ chối
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *       500:
 *         description: Lỗi server
 */
router.post('/:appointmentId/reject', authenticate, rejectAppointment as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/{appointmentId}/reschedule:
 *   put:
 *     summary: Dời lịch hẹn (Tối đa 3 lần)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch hẹn
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newDate
 *               - reason
 *             properties:
 *               newDate:
 *                 type: string
 *                 format: date-time
 *                 description: Ngày giờ mới
 *                 example: "2025-10-31T14:00:00Z"
 *               reason:
 *                 type: string
 *                 description: Lý do dời lịch
 *                 example: "Bận công việc đột xuất"
 *     responses:
 *       200:
 *         description: Dời lịch thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Dời lịch hẹn thành công"
 *                 appointment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     scheduledDate:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       example: "PENDING"
 *                     rescheduledCount:
 *                       type: number
 *                       example: 1
 *       400:
 *         description: Đã vượt quá số lần dời lịch cho phép hoặc không thể dời lịch đã xác nhận
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền dời lịch
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *       500:
 *         description: Lỗi server
 */
router.put('/:appointmentId/reschedule', authenticate, rescheduleAppointment as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/{appointmentId}/cancel:
 *   put:
 *     summary: Hủy lịch hẹn và hoàn tiền cọc
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch hẹn
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do hủy lịch hẹn
 *                 example: "Đã mua xe khác"
 *     responses:
 *       200:
 *         description: Hủy lịch hẹn thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Hủy lịch hẹn thành công"
 *                 appointment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "CANCELLED"
 *                     cancelledAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền hủy lịch hẹn
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *       500:
 *         description: Lỗi server
 */
router.put('/:appointmentId/cancel', authenticate, cancelAppointment as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/{appointmentId}/complete:
 *   post:
 *     summary: Staff/Admin xác nhận buổi xem xe đã hoàn thành
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch hẹn cần đánh dấu hoàn thành
 *     responses:
 *       200:
 *         description: Đã đánh dấu hoàn thành
 *       400:
 *         description: Lịch hẹn chưa được xác nhận
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền thực hiện
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/:appointmentId/complete', authenticate, completeAppointment as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/user:
 *   get:
 *     summary: Lấy danh sách lịch hẹn của user (Buyer hoặc Seller)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, RESCHEDULED, COMPLETED, CANCELLED]
 *         description: Lọc theo trạng thái
 *         example: "PENDING"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CONTRACT_SIGNING, VEHICLE_INSPECTION, DELIVERY]
 *         description: Lọc theo loại lịch hẹn
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng kết quả mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       listing:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           make:
 *                             type: string
 *                             example: "Tesla"
 *                           model:
 *                             type: string
 *                             example: "Model 3"
 *                           year:
 *                             type: number
 *                             example: 2023
 *                       seller:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                           phone:
 *                             type: string
 *                       scheduledDate:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         example: "PENDING"
 *                       buyerConfirmed:
 *                         type: boolean
 *                       sellerConfirmed:
 *                         type: boolean
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 5
 *                     totalPages:
 *                       type: integer
 *                       example: 1
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get('/user', authenticate, getUserAppointments as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/staff:
 *   get:
 *     summary: Lấy danh sách lịch hẹn cho Staff/Admin (không phân trang)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Lọc theo trạng thái (CONFIRMED, COMPLETED, CANCELLED - có thể nhiều, ngăn cách bằng dấu phẩy)
 *         example: "CONFIRMED,COMPLETED,CANCELLED"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên buyer/seller, email, phone hoặc appointment ID
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy danh sách appointment thành công"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *                 total:
 *                   type: integer
 *                   description: Tổng số appointments sau khi filter
 *                   example: 10
 *                 filters:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "CONFIRMED,COMPLETED,CANCELLED"
 *                       description: "Mặc định hiển thị 3 trạng thái: CONFIRMED (chờ xử lý), COMPLETED (đã hoàn thành), CANCELLED (đã hủy)"
 *                     search:
 *                       type: string
 *                       example: ""
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Chỉ staff/admin mới có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get('/staff', authenticate, getStaffAppointments as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/{appointmentId}:
 *   get:
 *     summary: Lấy chi tiết lịch hẹn
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch hẹn
 *         example: "673c1234567890abcdef1234"
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     depositRequest:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         depositAmount:
 *                           type: number
 *                           example: 5000000
 *                     buyer:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                           example: "Trần Thị B"
 *                         phone:
 *                           type: string
 *                           example: "0123456789"
 *                     seller:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     listing:
 *                       type: object
 *                       properties:
 *                         make:
 *                           type: string
 *                           example: "Tesla"
 *                         model:
 *                           type: string
 *                           example: "Model 3"
 *                         priceListed:
 *                           type: number
 *                           example: 750000000
 *                     scheduledDate:
 *                       type: string
 *                       format: date-time
 *                     location:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "CONFIRMED"
 *                     buyerConfirmed:
 *                       type: boolean
 *                     sellerConfirmed:
 *                       type: boolean
 *                     rescheduledCount:
 *                       type: number
 *                     maxReschedules:
 *                       type: number
 *                     notes:
 *                       type: string
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền xem lịch hẹn này
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *       500:
 *         description: Lỗi server
 */
router.get('/:appointmentId', authenticate, getAppointmentDetails as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/auction/{auctionId}:
 *   post:
 *     summary: Tạo lịch hẹn từ phiên đấu giá (cho người thắng cuộc)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của phiên đấu giá
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: Ngày giờ hẹn (mặc định 7 ngày sau nếu không cung cấp)
 *               location:
 *                 type: string
 *                 description: Địa điểm gặp mặt
 *               notes:
 *                 type: string
 *                 description: Ghi chú thêm
 *     responses:
 *       200:
 *         description: Tạo lịch hẹn thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 appointment:
 *                   type: object
 *       400:
 *         description: Lỗi tạo lịch hẹn (không phải winner, đấu giá chưa kết thúc, etc.)
 *       401:
 *         description: Chưa đăng nhập
 */
router.post('/auction/:auctionId', authenticate, createAppointmentFromAuction as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/auction/list:
 *   get:
 *     summary: Lấy danh sách lịch hẹn từ các phiên đấu giá
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, RESCHEDULED, COMPLETED, CANCELLED]
 *         description: Lọc theo trạng thái
 *         example: "PENDING"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng kết quả mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy danh sách lịch hẹn đấu giá thành công"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       auctionId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           startingPrice:
 *                             type: number
 *                           winningBid:
 *                             type: object
 *                           status:
 *                             type: string
 *                           listingId:
 *                             type: object
 *                             properties:
 *                               make:
 *                                 type: string
 *                               model:
 *                                 type: string
 *                               year:
 *                                 type: number
 *                               photos:
 *                                 type: array
 *                       buyerId:
 *                         type: object
 *                         properties:
 *                           fullName:
 *                             type: string
 *                           email:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                       sellerId:
 *                         type: object
 *                         properties:
 *                           fullName:
 *                             type: string
 *                           email:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                       scheduledDate:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                       buyerConfirmed:
 *                         type: boolean
 *                       sellerConfirmed:
 *                         type: boolean
 *                       appointmentType:
 *                         type: string
 *                         example: "AUCTION"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get('/auction/list', authenticate, getAuctionAppointments as unknown as RequestHandler);

/**
 * @swagger
 * /api/appointments/{appointmentId}/deposit:
 *   post:
 *     summary: Staff tạo đặt cọc 10%
 *     description: |
 *       Staff tạo yêu cầu đặt cọc 10% cho appointment đã COMPLETED. 
 *       Hệ thống sẽ tính tiền đặt cọc = 10% giá listing và tạo payment URL từ VNPay.
 *       Timeline.depositRequestAt sẽ được lưu ngay khi tạo.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của appointment (phải ở status COMPLETED)
 *         example: "64fb3c81a9c2c0a1b6a12345"
 *     responses:
 *       200:
 *         description: Tạo đặt cọc thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc appointment không ở trạng thái COMPLETED
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       404:
 *         description: Không tìm thấy appointment
 */
router.post(
  '/:appointmentId/deposit',
  authenticate,
  requireRole(['staff', 'admin']),
  createDeposit as unknown as RequestHandler
);

router.post(
  '/deals/:dealId/notarization-request',
  authenticate,
  requireRole(['staff', 'admin']),
  requestNotarizationAppointment as unknown as RequestHandler
);

router.post(
  '/:appointmentId/select-slot',
  authenticate,
  selectAppointmentSlot as unknown as RequestHandler
);

router.post(
  '/:appointmentId/decline-slot',
  authenticate,
  declineNotarizationAppointment as unknown as RequestHandler
);

router.post(
  '/deals/:dealId/handover-request',
  authenticate,
  requireRole(['staff', 'admin']),
  requestHandoverAppointment as unknown as RequestHandler
);

router.post(
  '/:appointmentId/notarization-proof',
  authenticate,
  requireRole(['staff', 'admin']),
  memoryUpload.array('photos', 10),
  uploadNotarizationProof as unknown as RequestHandler
);

router.post(
  '/:appointmentId/handover-proof',
  authenticate,
  requireRole(['staff', 'admin']),
  memoryUpload.array('photos', 10),
  uploadHandoverProof as unknown as RequestHandler
);

/**
 * @swagger
 * /api/appointments/{appointmentId}/full-payment:
 *   post:
 *     summary: Staff tạo thanh toán toàn bộ 100%
 *     description: |
 *       Staff tạo yêu cầu thanh toán toàn bộ 100% cho appointment đã COMPLETED. 
 *       Hệ thống sẽ tính tiền thanh toán = 100% giá listing và tạo payment URL từ VNPay.
 *       Timeline.fullPaymentRequestAt sẽ được lưu ngay khi tạo.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của appointment (phải ở status COMPLETED)
 *         example: "64fb3c81a9c2c0a1b6a12345"
 *     responses:
 *       200:
 *         description: Tạo thanh toán toàn bộ thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc appointment không ở trạng thái COMPLETED
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       404:
 *         description: Không tìm thấy appointment
 */
router.post(
  '/:appointmentId/full-payment',
  authenticate,
  requireRole(['staff', 'admin']),
  createFullPayment as unknown as RequestHandler
);

/**
 * @swagger
 * /api/appointments/{appointmentId}/remaining-payment:
 *   post:
 *     summary: User tự tạo thanh toán còn lại 90%
 *     description: |
 *       User (buyer) tự tạo yêu cầu thanh toán còn lại 90% sau khi đã đặt cọc 10% thành công.
 *       Hệ thống sẽ tính tiền thanh toán = 90% giá listing và tạo payment URL từ VNPay.
 *       Timeline.remainingPaymentRequestAt sẽ được lưu ngay khi tạo.
 *       Sau khi thanh toán thành công, appointment.status sẽ chuyển thành COMPLETED.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của appointment (phải ở status COMPLETED và đã đặt cọc 10%)
 *         example: "64fb3c81a9c2c0a1b6a12345"
 *     responses:
 *       200:
 *         description: Tạo thanh toán còn lại thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Tạo thanh toán còn lại thành công"
 *                 paymentUrl:
 *                   type: string
 *                   description: URL thanh toán VNPay (dùng để tạo QR code)
 *                 orderId:
 *                   type: string
 *                   description: Mã giao dịch VNPay
 *                 amount:
 *                   type: number
 *                   description: Số tiền thanh toán (90% giá listing)
 *                 qrCode:
 *                   type: string
 *                   description: URL thanh toán (giống paymentUrl, dùng để tạo QR code)
 *       400:
 *         description: Dữ liệu không hợp lệ, chưa đặt cọc 10%, hoặc đã thanh toán đủ
 *       403:
 *         description: Không có quyền (chỉ buyer của appointment)
 *       404:
 *         description: Không tìm thấy appointment
 */
router.post(
  '/:appointmentId/remaining-payment',
  authenticate,
  createRemainingPayment as unknown as RequestHandler
);

/**
 * @swagger
 * /api/appointments/{appointmentId}/timeline:
 *   get:
 *     summary: User xem timeline giao dịch
 *     description: |
 *       Lấy timeline giao dịch của appointment bao gồm:
 *       - depositRequestAt: Thời điểm staff tạo đặt cọc
 *       - depositPaidAt: Thời điểm user thanh toán đặt cọc 10%
 *       - remainingPaymentRequestAt: Thời điểm user tạo thanh toán 90%
 *       - remainingPaidAt: Thời điểm user thanh toán 90% thành công
 *       - fullPaymentRequestAt: Thời điểm staff tạo thanh toán toàn bộ
 *       - fullPaymentPaidAt: Thời điểm user thanh toán toàn bộ 100% thành công
 *       - completedAt: Thời điểm giao dịch hoàn thành
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của appointment
 *         example: "64fb3c81a9c2c0a1b6a12345"
 *     responses:
 *       200:
 *         description: Timeline giao dịch
 *       403:
 *         description: Không có quyền xem timeline (chỉ buyer, seller hoặc staff)
 *       404:
 *         description: Không tìm thấy appointment
 */
router.get(
  '/:appointmentId/timeline',
  authenticate,
  getAppointmentTimeline as unknown as RequestHandler
);

export default router;