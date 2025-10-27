import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
import User from '../models/User';
import Profile from '../models/Profile';

// Lấy thông tin hợp đồng (người mua/bán và xe)
export const getContractInfo = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id;

    // Kiểm tra appointment tồn tại
    const appointment = await Appointment.findById(appointmentId)
      .populate('depositRequestId')
      .populate('buyerId', 'name email phone')
      .populate('sellerId', 'name email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền xem (chỉ người mua, người bán hoặc nhân viên)
    const isBuyer = appointment.buyerId._id.toString() === userId;
    const isSeller = appointment.sellerId._id.toString() === userId;
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';

    if (!isBuyer && !isSeller && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem thông tin hợp đồng này'
      });
    }

    // Lấy thông tin chi tiết
    const listing = await Listing.findById(appointment.depositRequestId.listingId);
    const buyerProfile = await Profile.findOne({ userId: appointment.buyerId._id });
    const sellerProfile = await Profile.findOne({ userId: appointment.sellerId._id });

    if (!listing) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy thông tin xe'
      });
    }

    res.json({
      success: true,
      message: 'Lấy thông tin hợp đồng thành công',
      contractInfo: {
        // Thông tin người mua
        buyer: {
          name: buyerProfile?.fullName || appointment.buyerId.name,
          email: appointment.buyerId.email,
          phone: appointment.buyerId.phone,
          idNumber: buyerProfile?.idNumber || '',
          idIssuedDate: buyerProfile?.idIssuedDate || null,
          idIssuedBy: buyerProfile?.idIssuedBy || '',
          address: buyerProfile?.address || ''
        },
        
        // Thông tin người bán
        seller: {
          name: sellerProfile?.fullName || appointment.sellerId.name,
          email: appointment.sellerId.email,
          phone: appointment.sellerId.phone,
          idNumber: sellerProfile?.idNumber || '',
          idIssuedDate: sellerProfile?.idIssuedDate || null,
          idIssuedBy: sellerProfile?.idIssuedBy || '',
          address: sellerProfile?.address || ''
        },
        
        // Thông tin xe
        vehicle: {
          title: listing.title,
          brand: listing.brand,
          model: listing.model,
          type: listing.type,
          color: listing.color,
          year: listing.year,
          price: listing.price,
          engineNumber: listing.engineNumber,
          chassisNumber: listing.chassisNumber,
          seatCount: listing.seatCount,
          licensePlate: listing.licensePlate,
          registrationNumber: listing.registrationNumber,
          registrationDate: listing.registrationDate,
          registrationIssuedBy: listing.registrationIssuedBy,
          registrationIssuedTo: listing.registrationIssuedTo,
          registrationAddress: listing.registrationAddress
        },
        
        // Thông tin giao dịch
        transaction: {
          depositAmount: appointment.depositRequestId.depositAmount,
          appointmentDate: appointment.scheduledDate,
          location: appointment.location
        }
      }
    });

  } catch (error) {
    console.error('Error getting contract info:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message
    });
  }
};

