import { Request, Response, NextFunction } from 'express';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
import { User } from '../models/User';
import emailService from '../services/emailService';
import walletService from '../services/walletService';
import appointmentService from '../services/appointmentService';

// Tạo lịch hẹn sau khi người bán xác nhận cọc
export const createAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { depositRequestId, scheduledDate, location, notes } = req.body;
    const userId = (req as any).user.userId;

    // Gọi service
    const appointment = await appointmentService.createAppointmentFromDeposit({
      depositRequestId,
      userId,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      location,
      notes
    });

    res.json({
      success: true,
      message: 'Đã tạo lịch hẹn ký hợp đồng',
      appointment: {
        id: appointment._id,
        scheduledDate: appointment.scheduledDate,
        location: appointment.location,
        status: appointment.status,
        type: appointment.type
      }
    });

  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Xác nhận lịch hẹn
export const confirmAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const userId = (req as any).user.userId;

    const result = await appointmentService.confirmAppointment(appointmentId, userId);

    res.json({
      success: true,
      message: result.message,
      appointment: {
        id: result.appointment._id,
        scheduledDate: result.appointment.scheduledDate,
        status: result.appointment.status,
        buyerConfirmed: result.appointment.buyerConfirmed,
        sellerConfirmed: result.appointment.sellerConfirmed
      }
    });

  } catch (error) {
    console.error('Error confirming appointment:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Từ chối appointment và tự động dời lịch
export const rejectAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user.userId;

    // Sử dụng appointmentService
    const result = await appointmentService.rejectAppointment(appointmentId, userId, reason);

    res.json({
      success: true,
      message: result.message,
      appointment: result.appointment
    });
  } catch (error) {
    console.error('Error rejecting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Dời lịch hẹn (tối đa 1 lần)
export const rescheduleAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const { newDate, reason } = req.body;
    const userId = (req as any).user.userId;

    const appointment = await appointmentService.rescheduleAppointment(
      appointmentId,
      new Date(newDate),
      reason,
      userId
    );

    res.json({
      success: true,
      message: 'Dời lịch hẹn thành công',
      appointment: {
        id: appointment._id,
        scheduledDate: appointment.scheduledDate,
        status: appointment.status,
        rescheduledCount: appointment.rescheduledCount
      }
    });

  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Hủy lịch hẹn
export const cancelAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user.userId;

    const appointment = await appointmentService.cancelAppointment(
      appointmentId,
      reason,
      userId
    );

    res.json({
      success: true,
      message: 'Hủy lịch hẹn thành công',
      appointment: {
        id: appointment._id,
        status: appointment.status,
        cancelledAt: appointment.cancelledAt
      }
    });

  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy danh sách lịch hẹn của user
export const getUserAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { status, type, page = 1, limit = 10 } = req.query;

    const appointments = await appointmentService.getUserAppointments(
      userId,
      status as string,
      type as string,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: appointments.data,
      pagination: appointments.pagination
    });

  } catch (error) {
    console.error('Error getting user appointments:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy chi tiết lịch hẹn
export const getAppointmentDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const userId = (req as any).user.userId;

    const appointment = await appointmentService.getAppointmentById(appointmentId, userId);

    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    console.error('Error getting appointment details:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Lấy danh sách appointment cho staff
export const getStaffAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.userId;

    // Kiểm tra quyền staff
    const isStaff = (req as any).user.role === 'staff' || (req as any).user.role === 'admin';
    if (!isStaff) {
      res.status(403).json({
        success: false,
        message: 'Chỉ nhân viên mới có quyền truy cập'
      });
      return;
    }

    const { status, page = 1, limit = 10, search } = req.query;

    const result = await appointmentService.getStaffAppointments(
      status as string,
      search as string,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      message: 'Lấy danh sách appointment thành công',
      data: result.data,
      pagination: result.pagination,
      filters: {
        status: status || 'CONFIRMED,PENDING,RESCHEDULED',
        search: search || ''
      }
    });

  } catch (error) {
    console.error('Error getting staff appointments:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi hệ thống',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
