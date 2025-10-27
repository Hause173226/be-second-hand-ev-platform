import express from 'express';
import {
  createAppointment,
  confirmAppointment,
  rejectAppointment,
  rescheduleAppointment,
  cancelAppointment,
  getUserAppointments,
  getAppointmentDetails,
  getStaffAppointments
} from '../controllers/appointmentController';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

// Tạo lịch hẹn
router.post('/', authenticate, createAppointment);

// Xác nhận lịch hẹn
router.post('/:appointmentId/confirm', authenticate, confirmAppointment);

// Từ chối lịch hẹn (tự động dời 1 tuần)
router.post('/:appointmentId/reject', authenticate, rejectAppointment);

// Dời lịch hẹn
router.put('/:appointmentId/reschedule', authenticate, rescheduleAppointment);

// Hủy lịch hẹn
router.put('/:appointmentId/cancel', authenticate, cancelAppointment);

// Lấy danh sách lịch hẹn của user
router.get('/user', authenticate, getUserAppointments);

// Lấy danh sách appointment cho staff
router.get('/staff', authenticate, getStaffAppointments);

// Lấy chi tiết lịch hẹn
router.get('/:appointmentId', authenticate, getAppointmentDetails);

export default router;