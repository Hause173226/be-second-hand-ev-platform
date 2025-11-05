import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuctionDeposit extends Document {
  auctionId: Types.ObjectId;
  userId: Types.ObjectId;
  depositAmount: number;
  status: 'FROZEN' | 'REFUNDED' | 'DEDUCTED' | 'CANCELLED';
  frozenAt: Date;
  refundedAt?: Date;
  deductedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuctionDepositSchema = new Schema({
  auctionId: {
    type: Schema.Types.ObjectId,
    ref: 'Auction',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  depositAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['FROZEN', 'REFUNDED', 'DEDUCTED', 'CANCELLED'],
    default: 'FROZEN'
  },
  frozenAt: {
    type: Date,
    default: Date.now
  },
  refundedAt: {
    type: Date
  },
  deductedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index để tránh trùng lặp: 1 user chỉ có 1 deposit cho 1 auction
AuctionDepositSchema.index({ auctionId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IAuctionDeposit>('AuctionDeposit', AuctionDepositSchema);
