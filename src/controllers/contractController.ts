import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
import { User } from '../models/User';

// Lấy thông tin hợp đồng (người mua/bán và xe)
export const getContractInfo = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id;

    // Kiểm tra appointment tồn tại
    const appointment = await Appointment.findById(appointmentId)
      .populate('depositRequestId')
      .populate('buyerId', 'fullName email phone')
      .populate('sellerId', 'fullName email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền xem (chỉ người mua, người bán hoặc nhân viên)
    const isBuyer = (appointment.buyerId as any)._id.toString() === userId;
    const isSeller = (appointment.sellerId as any)._id.toString() === userId;
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';

    if (!isBuyer && !isSeller && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem thông tin hợp đồng này'
      });
    }

    // Lấy thông tin chi tiết
    const listing = await Listing.findById((appointment.depositRequestId as any).listingId);
    const buyerProfile = await User.findById((appointment.buyerId as any)._id);
    const sellerProfile = await User.findById((appointment.sellerId as any)._id);

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
          name: buyerProfile?.fullName || (appointment.buyerId as any).fullName,
          email: (appointment.buyerId as any).email,
          phone: (appointment.buyerId as any).phone,
          idNumber: buyerProfile?.citizenId || '',
          address: buyerProfile?.address?.fullAddress || ''
        },
        
        // Thông tin người bán
        seller: {
          name: sellerProfile?.fullName || (appointment.sellerId as any).fullName,
          email: (appointment.sellerId as any).email,
          phone: (appointment.sellerId as any).phone,
          idNumber: sellerProfile?.citizenId || '',
          address: sellerProfile?.address?.fullAddress || ''
        },
        
        // Thông tin xe
        vehicle: {
          title: (listing as any).title,
          brand: (listing as any).brand,
          model: (listing as any).model,
          type: (listing as any).type,
          color: (listing as any).color,
          year: (listing as any).year,
          price: (listing as any).price,
          engineNumber: (listing as any).engineNumber || '',
          chassisNumber: (listing as any).chassisNumber || '',
          seatCount: (listing as any).seatCount || '',
          licensePlate: (listing as any).licensePlate || '',
          registrationNumber: (listing as any).registrationNumber || '',
          registrationDate: (listing as any).registrationDate || null,
          registrationIssuedBy: (listing as any).registrationIssuedBy || '',
          registrationIssuedTo: (listing as any).registrationIssuedTo || '',
          registrationAddress: (listing as any).registrationAddress || ''
        },
        
        // Thông tin giao dịch
        transaction: {
          depositAmount: (appointment.depositRequestId as any).depositAmount,
          appointmentDate: appointment.scheduledDate,
          location: appointment.location
        }
      }
    });

  } catch (error: any) {
    console.error('Error getting contract info:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error?.message || 'Unknown error'
    });
  }
};

