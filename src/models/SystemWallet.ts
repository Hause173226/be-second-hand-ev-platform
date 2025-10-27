import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemWallet extends Document {
  balance: number;
  totalEarned: number;
  totalTransactions: number;
  lastTransactionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SystemWalletSchema = new Schema({
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalTransactions: {
    type: Number,
    default: 0,
    min: 0
  },
  lastTransactionAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Ensure only one system wallet exists
SystemWalletSchema.index({}, { unique: true });

export default mongoose.model<ISystemWallet>('SystemWallet', SystemWalletSchema);
