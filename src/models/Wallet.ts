// src/models/Wallet.ts
import mongoose, { Schema, Document } from 'mongoose';

interface IWallet extends Document {
  userId: string;                    // ID người dùng
  balance: number;                   // Số dư hiện tại (VNĐ)
  frozenAmount: number;              // Số tiền bị đóng băng (trong escrow)
  totalDeposited: number;            // Tổng tiền đã nạp
  totalWithdrawn: number;            // Tổng tiền đã rút
  currency: string;                  // Đơn vị tiền tệ (VND)
  status: WalletStatus;             // Trạng thái ví
  lastTransactionAt?: Date;         // Thời gian giao dịch cuối
  createdAt: Date;
  updatedAt: Date;
}

enum WalletStatus {
  ACTIVE = 'ACTIVE',                // Hoạt động bình thường
  FROZEN = 'FROZEN',                // Bị đóng băng
  SUSPENDED = 'SUSPENDED'           // Bị tạm khóa
}

const WalletSchema = new Schema({
  userId: { 
    type: String, 
    required: true,
    unique: true,
    ref: 'User'
  },
  balance: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0
  },
  frozenAmount: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0
  },
  totalDeposited: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0
  },
  totalWithdrawn: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0
  },
  currency: { 
    type: String, 
    required: true,
    default: 'VND'
  },
  status: { 
    type: String, 
    enum: Object.values(WalletStatus),
    default: WalletStatus.ACTIVE
  },
  lastTransactionAt: { 
    type: Date 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index để tối ưu query
WalletSchema.index({ userId: 1 });
WalletSchema.index({ status: 1 });

export default mongoose.model<IWallet>('Wallet', WalletSchema);