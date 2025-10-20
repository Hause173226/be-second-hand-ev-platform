// src/routes/appointmentRoutes.ts
import express from "express";
import {
    createAppointment,
    getUserAppointments,
    updateAppointmentStatus,
    getAppointmentById,
    deleteAppointment,
} from "../controllers/appointmentController";
import { authenticate } from "../middlewares/authenticate";

// Router cho các API endpoints liên quan đến appointments và lịch hẹn
const router = express.Router();

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Tạo lịch hẹn mới
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAppointmentRequest'
 *     responses:
 *       201:
 *         description: Tạo lịch hẹn thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Yêu cầu không hợp lệ - Thiếu các trường bắt buộc hoặc dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền truy cập - Người dùng không có quyền truy cập chat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy chat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authenticate, createAppointment);

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Lấy danh sách lịch hẹn của người dùng
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed]
 *         description: Lọc theo trạng thái lịch hẹn
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang cho phân trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of appointments per page
 *     responses:
 *       200:
 *         description: Lấy danh sách lịch hẹn thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AppointmentListResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", authenticate, getUserAppointments);

/**
 * @swagger
 * /api/appointments/{appointmentId}:
 *   get:
 *     summary: Lấy lịch hẹn theo ID
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID lịch hẹn
 *     responses:
 *       200:
 *         description: Lấy lịch hẹn thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       403:
 *         description: Access denied - User doesn't have access to this appointment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:appointmentId", authenticate, getAppointmentById);

/**
 * @swagger
 * /api/appointments/{appointmentId}/status:
 *   put:
 *     summary: Cập nhật trạng thái lịch hẹn
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID lịch hẹn
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAppointmentStatusRequest'
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái lịch hẹn thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Bad request - Invalid status or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - User doesn't have access to this appointment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:appointmentId/status", authenticate, updateAppointmentStatus);

/**
 * @swagger
 * /api/appointments/{appointmentId}:
 *   delete:
 *     summary: Xóa lịch hẹn
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID lịch hẹn
 *     responses:
 *       200:
 *         description: Xóa lịch hẹn thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Bad request - Can only delete pending appointments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - Only buyer can delete appointments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:appointmentId", authenticate, deleteAppointment);

export default router;