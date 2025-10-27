import mongoose, { Schema, Document } from 'mongoose';

export interface IContract extends Document {
  appointmentId: string;
  depositRequestId: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  
  // Contract details
  contractNumber: string;
  contractDate: Date;
  
  // Buyer information
  buyerName: string;
  buyerIdNumber: string;
  buyerIdIssuedDate: Date;
  buyerIdIssuedBy: string;
  buyerAddress: string;
  
  // Seller information
  sellerName: string;
  sellerIdNumber: string;
  sellerIdIssuedDate: Date;
  sellerIdIssuedBy: string;
  sellerAddress: string;
  
  // Vehicle information
  vehicleBrand: string;
  vehicleModel: string;
  vehicleType: string;
  vehicleColor: string;
  engineNumber: string;
  chassisNumber: string;
  seatCount: number;
  manufactureYear: number;
  licensePlate: string;
  registrationNumber: string;
  registrationIssuedDate: Date;
  registrationIssuedBy: string;
  registrationIssuedTo: string;
  registrationAddress: string;
  
  // Transaction details
  purchasePrice: number;
  depositAmount: number;
  paymentMethod: string;
  
  // Contract status
  status: 'DRAFT' | 'SIGNED' | 'COMPLETED' | 'CANCELLED';
  signedAt?: Date;
  
  // Contract file (optional)
  contractPdfUrl?: string;
  
  // Contract photos uploaded by staff
  contractPhotos: [{
    url: string;           // Cloudinary URL
    publicId: string;      // Cloudinary public_id
    uploadedBy: string;    // Staff ID
    uploadedAt: Date;
    description?: string;  // Mô tả ảnh
  }];
  
  // Staff information
  staffId?: string;       // ID của nhân viên xử lý
  staffName?: string;     // Tên nhân viên
  completedAt?: Date;     // Thời gian hoàn thành giao dịch
  
  createdAt: Date;
  updatedAt: Date;
}

const ContractSchema = new Schema({
  appointmentId: {
    type: String,
    required: true,
    ref: 'Appointment'
  },
  depositRequestId: {
    type: String,
    required: true,
    ref: 'DepositRequest'
  },
  buyerId: {
    type: String,
    required: true,
    ref: 'User'
  },
  sellerId: {
    type: String,
    required: true,
    ref: 'User'
  },
  listingId: {
    type: String,
    required: true,
    ref: 'Listing'
  },
  
  // Contract details
  contractNumber: {
    type: String,
    required: true,
    unique: true
  },
  contractDate: {
    type: Date,
    required: true
  },
  
  // Buyer information
  buyerName: { type: String, required: true },
  buyerIdNumber: { type: String, required: true },
  buyerIdIssuedDate: { type: Date, required: true },
  buyerIdIssuedBy: { type: String, required: true },
  buyerAddress: { type: String, required: true },
  
  // Seller information
  sellerName: { type: String, required: true },
  sellerIdNumber: { type: String, required: true },
  sellerIdIssuedDate: { type: Date, required: true },
  sellerIdIssuedBy: { type: String, required: true },
  sellerAddress: { type: String, required: true },
  
  // Vehicle information
  vehicleBrand: { type: String, required: true },
  vehicleModel: { type: String, required: true },
  vehicleType: { type: String, required: true },
  vehicleColor: { type: String, required: true },
  engineNumber: { type: String, required: true },
  chassisNumber: { type: String, required: true },
  seatCount: { type: Number, required: true },
  manufactureYear: { type: Number, required: true },
  licensePlate: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  registrationIssuedDate: { type: Date, required: true },
  registrationIssuedBy: { type: String, required: true },
  registrationIssuedTo: { type: String, required: true },
  registrationAddress: { type: String, required: true },
  
  // Transaction details
  purchasePrice: { type: Number, required: true },
  depositAmount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  
  // Contract status
  status: {
    type: String,
    enum: ['DRAFT', 'SIGNED', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT'
  },
  signedAt: { type: Date },
  
  // Contract file (optional)
  contractPdfUrl: { type: String },
  
  // Contract photos uploaded by staff
  contractPhotos: [{
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    uploadedBy: { type: String, required: true, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
    description: { type: String }
  }],
  
  // Staff information
  staffId: { type: String, ref: 'User' },
  staffName: { type: String },
  completedAt: { type: Date }
}, {
  timestamps: true
});

// Indexes
ContractSchema.index({ buyerId: 1, status: 1 });
ContractSchema.index({ sellerId: 1, status: 1 });
ContractSchema.index({ appointmentId: 1 });
ContractSchema.index({ contractNumber: 1 });

export default mongoose.model<IContract>('Contract', ContractSchema);
