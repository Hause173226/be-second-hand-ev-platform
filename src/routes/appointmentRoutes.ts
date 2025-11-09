// src/routes/appointmentRoutes.ts
import express from "express";
import {
    createAppointment,
    getUserAppointments,
    confirmAppointment,
    rejectAppointment,
    rescheduleAppointment,
    cancelAppointment,
    getAppointmentDetails,
    getStaffAppointments,
    createAppointmentFromAuction,
    getAuctionAppointments,
} from "../controllers/appointmentController";
import { authenticate } from "../middlewares/authenticate";

// Router cho các API endpoints liên quan đến appointments và lịch hẹn
const router = express.Router();

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
router.post('/', authenticate, createAppointment);

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
router.post('/:appointmentId/confirm', authenticate, confirmAppointment);

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
router.post('/:appointmentId/reject', authenticate, rejectAppointment);

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
router.put('/:appointmentId/reschedule', authenticate, rescheduleAppointment);

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
router.put('/:appointmentId/cancel', authenticate, cancelAppointment);

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
router.get('/user', authenticate, getUserAppointments);

/**
 * @swagger
 * /api/appointments/staff:
 *   get:
 *     summary: Lấy danh sách lịch hẹn cho Staff/Admin
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Lọc theo trạng thái (có thể nhiều, ngăn cách bằng dấu phẩy)
 *         example: "CONFIRMED,PENDING,RESCHEDULED"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên buyer/seller
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
 *                   example: "Lấy danh sách appointment thành công"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                 filters:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     search:
 *                       type: string
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Chỉ staff/admin mới có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get('/staff', authenticate, getStaffAppointments);

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
router.get('/:appointmentId', authenticate, getAppointmentDetails);

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
router.post('/auction/:auctionId', authenticate, createAppointmentFromAuction);

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
router.get('/auction/list', authenticate, getAuctionAppointments);

export default router;