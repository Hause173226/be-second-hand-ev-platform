import mongoose, { Schema, Document } from 'mongoose';

export interface IEscrowAccount extends Document {
  depositRequestId: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  amount: number;
  status: 'ACTIVE' | 'RELEASED' | 'REFUNDED';
  releasedAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EscrowAccountSchema = new Schema({
  depositRequestId: {
    type: String,
    required: true,
    ref: 'DepositRequest',
    unique: true
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
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'RELEASED', 'REFUNDED'],
    default: 'ACTIVE'
  },
  releasedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
EscrowAccountSchema.index({ buyerId: 1, status: 1 });
EscrowAccountSchema.index({ sellerId: 1, status: 1 });
EscrowAccountSchema.index({ depositRequestId: 1 });

export default mongoose.model<IEscrowAccount>('EscrowAccount', EscrowAccountSchema);
