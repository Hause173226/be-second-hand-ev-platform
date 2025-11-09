import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
  // Có thể là depositRequestId (luồng thường) hoặc auctionId (luồng đấu giá)
  depositRequestId?: string;
  auctionId?: string;
  appointmentType: 'NORMAL_DEPOSIT' | 'AUCTION';
  buyerId: string;
  sellerId: string;
  scheduledDate: Date;
  status: 'PENDING' | 'CONFIRMED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
  type: 'CONTRACT_SIGNING' | 'VEHICLE_INSPECTION' | 'DELIVERY';
  location?: string;
  notes?: string;
  rescheduledCount: number;
  maxReschedules: number;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  buyerConfirmedAt?: Date;
  sellerConfirmedAt?: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema({
  depositRequestId: {
    type: String,
    ref: 'DepositRequest'
  },
  auctionId: {
    type: String,
    ref: 'Auction'
  },
  appointmentType: {
    type: String,
    enum: ['NORMAL_DEPOSIT', 'AUCTION'],
    required: true
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
  scheduledDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'REJECTED'],
    default: 'PENDING'
  },
  type: {
    type: String,
    enum: ['CONTRACT_SIGNING', 'VEHICLE_INSPECTION', 'DELIVERY'],
    default: 'CONTRACT_SIGNING'
  },
  location: {
    type: String
  },
  notes: {
    type: String
  },
  rescheduledCount: {
    type: Number,
    default: 0
  },
  maxReschedules: {
    type: Number,
    default: 3
  },
  buyerConfirmed: {
    type: Boolean,
    default: false
  },
  sellerConfirmed: {
    type: Boolean,
    default: false
  },
  buyerConfirmedAt: {
    type: Date
  },
  sellerConfirmedAt: {
    type: Date
  },
  confirmedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
AppointmentSchema.index({ buyerId: 1, status: 1 });
AppointmentSchema.index({ sellerId: 1, status: 1 });
AppointmentSchema.index({ scheduledDate: 1 });
AppointmentSchema.index({ depositRequestId: 1 });
AppointmentSchema.index({ auctionId: 1 });
AppointmentSchema.index({ appointmentType: 1 });

export default mongoose.model<IAppointment>('Appointment', AppointmentSchema);