import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemWalletTransaction extends Document {
  type: 'COMPLETED' | 'CANCELLED'; // COMPLETED = +100%, CANCELLED = +20% phí hủy
  amount: number; // Số tiền nhận được
  depositRequestId?: string; // ID của deposit request (nếu có)
  appointmentId?: string; // ID của appointment (nếu có)
  description: string; // Mô tả giao dịch
  balanceAfter: number; // Số dư sau giao dịch
  createdAt: Date;
  updatedAt: Date;
}

const SystemWalletTransactionSchema = new Schema({
  type: {
    type: String,
    enum: ['COMPLETED', 'CANCELLED'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  depositRequestId: {
    type: String,
    index: true
  },
  appointmentId: {
    type: String,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

// Index để query nhanh
SystemWalletTransactionSchema.index({ createdAt: -1 });
SystemWalletTransactionSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model<ISystemWalletTransaction>('SystemWalletTransaction', SystemWalletTransactionSchema);

