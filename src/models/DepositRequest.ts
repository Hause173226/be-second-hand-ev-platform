import mongoose, { Schema, Document } from 'mongoose';

export interface IDepositRequest extends Document {
  listingId: string;
  buyerId: string;
  sellerId: string;
  depositAmount: number;
  status: 'PENDING_PAYMENT' | 'PENDING_SELLER_CONFIRMATION' | 'SELLER_CONFIRMED' | 'SELLER_CANCELLED' | 'IN_ESCROW' | 'COMPLETED' | 'CANCELLED';
  escrowAccountId?: string;
  sellerConfirmedAt?: Date;
  sellerCancelledAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DepositRequestSchema = new Schema({
  listingId: { 
    type: String, 
    required: true,
    ref: 'Listing'
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
  depositAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['PENDING_PAYMENT', 'PENDING_SELLER_CONFIRMATION', 'SELLER_CONFIRMED', 'SELLER_CANCELLED', 'IN_ESCROW', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING_SELLER_CONFIRMATION'
  },
  escrowAccountId: {
    type: String,
    ref: 'EscrowAccount'
  },
  sellerConfirmedAt: {
    type: Date
  },
  sellerCancelledAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 ngày
  }
}, {
  timestamps: true
});

// Indexes
DepositRequestSchema.index({ buyerId: 1, status: 1 });
DepositRequestSchema.index({ sellerId: 1, status: 1 });
DepositRequestSchema.index({ listingId: 1 });
DepositRequestSchema.index({ expiresAt: 1 });

export default mongoose.model<IDepositRequest>('DepositRequest', DepositRequestSchema);
