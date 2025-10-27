import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import DepositRequest from '../models/DepositRequest';
import Listing from '../models/Listing';
import Contract from '../models/Contract';
import { User } from '../models/User';
import walletService from '../services/walletService';
import { uploadFromBuffer } from '../services/cloudinaryService';
import depositNotificationService from '../services/depositNotificationService';

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

// Staff upload ảnh hợp đồng đã ký
export const uploadContractPhotos = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const staffId = req.user?.id;
    const { description } = req.body;

    // Kiểm tra quyền staff
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ nhân viên mới có quyền upload ảnh hợp đồng'
      });
    }

    // Kiểm tra appointment tồn tại và đã được xác nhận
    const appointment = await Appointment.findById(appointmentId)
      .populate('depositRequestId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    if (appointment.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn chưa được xác nhận hoặc đã hoàn thành'
      });
    }

    // Kiểm tra có file upload không
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 ảnh hợp đồng'
      });
    }

    // Upload ảnh lên Cloudinary
    const uploadedPhotos = [];
    for (const file of files) {
      try {
        const uploadResult = await uploadFromBuffer(
          file.buffer,
          `contract-${appointmentId}-${Date.now()}`,
          {
            folder: 'secondhand-ev/contracts/signed-contracts',
            resource_type: 'image'
          }
        );

        uploadedPhotos.push({
          url: uploadResult.secureUrl,
          publicId: uploadResult.publicId,
          uploadedBy: staffId!,
          uploadedAt: new Date(),
          description: description || 'Ảnh hợp đồng đã ký'
        });
      } catch (uploadError) {
        console.error('Error uploading photo:', uploadError);
        // Tiếp tục với các ảnh khác nếu có lỗi
      }
    }

    if (uploadedPhotos.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Không thể upload ảnh nào'
      });
    }

    // Tìm hoặc tạo Contract record
    let contract = await Contract.findOne({ appointmentId });
    
    if (!contract) {
      // Tạo contract mới với thông tin cơ bản
      const depositRequest = appointment.depositRequestId as any;
      const listing = await Listing.findById(depositRequest.listingId);
      const buyer = await User.findById(appointment.buyerId);
      const seller = await User.findById(appointment.sellerId);

      if (!listing || !buyer || !seller) {
        return res.status(400).json({
          success: false,
          message: 'Không tìm thấy thông tin giao dịch'
        });
      }

      contract = new Contract({
        appointmentId,
        depositRequestId: depositRequest._id,
        buyerId: appointment.buyerId,
        sellerId: appointment.sellerId,
        listingId: depositRequest.listingId,
        contractNumber: `CT-${Date.now()}`,
        contractDate: new Date(),
        
        // Thông tin người mua
        buyerName: buyer.fullName || buyer.email,
        buyerIdNumber: buyer.citizenId || '',
        buyerIdIssuedDate: new Date(), // Default value
        buyerIdIssuedBy: 'Cơ quan có thẩm quyền', // Default value
        buyerAddress: buyer.address?.fullAddress || '',
        
        // Thông tin người bán
        sellerName: seller.fullName || seller.email,
        sellerIdNumber: seller.citizenId || '',
        sellerIdIssuedDate: new Date(), // Default value
        sellerIdIssuedBy: 'Cơ quan có thẩm quyền', // Default value
        sellerAddress: seller.address?.fullAddress || '',
        
        // Thông tin xe
        vehicleBrand: listing.make || '',
        vehicleModel: listing.model || '',
        vehicleType: (listing as any).vehicleType || '',
        vehicleColor: (listing as any).paintColor || '',
        engineNumber: (listing as any).engineNumber || '',
        chassisNumber: (listing as any).chassisNumber || '',
        seatCount: 0, // Default value - không có trong model
        manufactureYear: listing.year || 0,
        licensePlate: (listing as any).licensePlate || '',
        registrationNumber: '', // Default value - không có trong model
        registrationIssuedDate: new Date(), // Default value
        registrationIssuedBy: 'Cơ quan có thẩm quyền', // Default value
        registrationIssuedTo: '', // Default value
        registrationAddress: '', // Default value
        
        // Thông tin giao dịch
        purchasePrice: listing.priceListed || 0,
        depositAmount: depositRequest.depositAmount,
        paymentMethod: 'Escrow',
        
        status: 'SIGNED',
        signedAt: new Date(),
        
        // Thông tin staff
        staffId: staffId!,
        staffName: req.user?.name || req.user?.email,
        
        contractPhotos: uploadedPhotos
      });
    } else {
      // Cập nhật contract hiện tại
      contract.contractPhotos.push(...uploadedPhotos);
      contract.status = 'SIGNED';
      contract.signedAt = new Date();
      contract.staffId = staffId!;
      contract.staffName = req.user?.name || req.user?.email;
    }

    await contract.save();

    // Gửi thông báo cho buyer và seller
    try {
      const staffInfo = { fullName: req.user?.name || req.user?.email || 'Nhân viên', avatar: req.user?.avatar || '' };
      
      // Gửi cho buyer
      await depositNotificationService.sendContractNotification(
        appointment.buyerId.toString(),
        contract,
        staffInfo
      );

      // Gửi cho seller
      await depositNotificationService.sendContractNotification(
        appointment.sellerId.toString(),
        contract,
        staffInfo
      );
    } catch (notificationError) {
      console.error('Error sending contract notification:', notificationError);
    }

    res.json({
      success: true,
      message: `Đã upload ${uploadedPhotos.length} ảnh hợp đồng thành công`,
      data: {
        contractId: contract._id,
        uploadedPhotos: uploadedPhotos.length,
        contractStatus: contract.status,
        photos: uploadedPhotos.map(photo => ({
          url: photo.url,
          description: photo.description,
          uploadedAt: photo.uploadedAt
        }))
      }
    });

  } catch (error: any) {
    console.error('Error uploading contract photos:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error?.message || 'Unknown error'
    });
  }
};

// Staff xác nhận giao dịch hoàn thành
export const completeTransaction = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const staffId = req.user?.id;

    // Kiểm tra quyền staff
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ nhân viên mới có quyền xác nhận giao dịch'
      });
    }

    // Kiểm tra appointment tồn tại
    const appointment = await Appointment.findById(appointmentId)
      .populate('depositRequestId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    if (appointment.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn chưa được xác nhận hoặc đã hoàn thành'
      });
    }

    // Kiểm tra contract đã có ảnh chưa
    const contract = await Contract.findOne({ appointmentId });
    if (!contract || !contract.contractPhotos || (contract.contractPhotos as any[]).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng upload ảnh hợp đồng trước khi xác nhận giao dịch'
      });
    }

    // Hoàn thành giao dịch
    const depositRequest = appointment.depositRequestId as any;
    
    // Chuyển tiền từ Escrow về hệ thống
    await walletService.completeTransaction(depositRequest._id);

    // Cập nhật trạng thái contract
    contract.status = 'COMPLETED';
    contract.completedAt = new Date();
    await contract.save();

    // Cập nhật trạng thái appointment
    appointment.status = 'COMPLETED';
    appointment.completedAt = new Date();
    await appointment.save();

    // Gửi thông báo cho buyer và seller
    try {
      await depositNotificationService.sendTransactionCompleteNotification(
        appointment.buyerId.toString(),
        appointment.sellerId.toString(),
        contract
      );
    } catch (notificationError) {
      console.error('Error sending transaction complete notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'Xác nhận giao dịch hoàn thành thành công',
      data: {
        contractId: contract._id,
        appointmentId: appointment._id,
        completedAt: contract.completedAt,
        contractPhotos: (contract.contractPhotos as any[]).length,
        transactionStatus: 'COMPLETED'
      }
    });

  } catch (error: any) {
    console.error('Error completing transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error?.message || 'Unknown error'
    });
  }
};

// Lấy danh sách contract cho staff
export const getStaffContracts = async (req: Request, res: Response) => {
  try {
    const staffId = req.user?.id;

    // Kiểm tra quyền staff
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';
    if (!isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ nhân viên mới có quyền truy cập'
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const contracts = await Contract.find(filter)
      .populate('appointmentId', 'scheduledDate status')
      .populate('buyerId', 'name email phone')
      .populate('sellerId', 'name email phone')
      .populate('listingId', 'title brand model year price')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Contract.countDocuments(filter);

    res.json({
      success: true,
      message: 'Lấy danh sách hợp đồng thành công',
      data: contracts,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total
      }
    });

  } catch (error: any) {
    console.error('Error getting staff contracts:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error?.message || 'Unknown error'
    });
  }
};

