import Wallet from '../models/Wallet';
import DepositRequest from '../models/DepositRequest';
import EscrowAccount from '../models/EscrowAccount';
import SystemWallet from '../models/SystemWallet';
import Appointment from '../models/Appointment';
import { createVNPayOrder, handleVNPayReturn, handleVNPayCallback } from './walletPaymentService';
import { Request } from 'express';

export class WalletService {
  // Tạo ví mới cho user
  async createWallet(userId: string) {
    const existingWallet = await Wallet.findOne({ userId });
    if (existingWallet) {
      throw new Error('Ví đã tồn tại');
    }

    const wallet = new Wallet({
      userId,
      balance: 0,
      frozenAmount: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      currency: 'VND',
      status: 'ACTIVE'
    });

    await wallet.save();
    return wallet;
  }

  // Lấy thông tin ví
  async getWallet(userId: string) {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await this.createWallet(userId);
    }
    return wallet;
  }

  // Nạp tiền vào ví
  async deposit(userId: string, amount: number, description?: string) {
    const wallet = await this.getWallet(userId);
    
    wallet.balance += amount;
    wallet.totalDeposited += amount;
    wallet.lastTransactionAt = new Date();
    
    await wallet.save();

    
    return wallet;
  }

  // Rút tiền từ ví
  async withdraw(userId: string, amount: number, description?: string) {
    const wallet = await this.getWallet(userId);
    
    if (wallet.balance < amount) {
      throw new Error('Số dư không đủ');
    }

    wallet.balance -= amount;
    wallet.totalWithdrawn += amount;
    wallet.lastTransactionAt = new Date();
    
    await wallet.save();

    // TODO: Tạo transaction record khi có WalletTransaction model
    return wallet;
  }

  // Đóng băng tiền (khi đặt cọc)
  async freezeAmount(userId: string, amount: number, description?: string) {
    const wallet = await this.getWallet(userId);
    
    if (wallet.balance < amount) {
      throw new Error('Số dư không đủ');
    }

    wallet.balance -= amount;
    wallet.frozenAmount += amount;
    wallet.lastTransactionAt = new Date();
    
    await wallet.save();

    // TODO: Tạo transaction record khi có WalletTransaction model
    return wallet;
  }

  // Giải phóng tiền đóng băng (khi hủy đặt cọc)
  async unfreezeAmount(userId: string, amount: number, description?: string) {
    const wallet = await this.getWallet(userId);
    
    if (wallet.frozenAmount < amount) {
      throw new Error('Số tiền đóng băng không đủ');
    }

    wallet.frozenAmount -= amount;
    wallet.balance += amount;
    wallet.lastTransactionAt = new Date();
    
    await wallet.save();

    // TODO: Tạo transaction record khi có WalletTransaction model
    return wallet;
  }

  // Chuyển tiền từ ví vào Escrow (khi người bán xác nhận)
  async transferToEscrow(depositRequestId: string) {
    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      throw new Error('Không tìm thấy yêu cầu đặt cọc');
    }

    const buyerWallet = await this.getWallet(depositRequest.buyerId);
    
    if (buyerWallet.frozenAmount < depositRequest.depositAmount) {
      throw new Error('Số tiền đóng băng không đủ');
    }

    // Giảm tiền đóng băng (tiền đã chuyển vào escrow)
    buyerWallet.frozenAmount -= depositRequest.depositAmount;
    buyerWallet.lastTransactionAt = new Date();
    
    await buyerWallet.save();

    // Tạo Escrow account
    const escrowAccount = new EscrowAccount({
      depositRequestId,
      buyerId: depositRequest.buyerId,
      sellerId: depositRequest.sellerId,
      listingId: depositRequest.listingId,
      amount: depositRequest.depositAmount,
      status: 'ACTIVE'
    });

    await escrowAccount.save();

    // Cập nhật trạng thái deposit request
    depositRequest.status = 'IN_ESCROW';
    depositRequest.escrowAccountId = (escrowAccount._id as any).toString();
    depositRequest.sellerConfirmedAt = new Date();
    await depositRequest.save();

    // Tạo appointment tự động (1 tuần sau)
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() + 7); // 1 tuần sau

    const appointment = new Appointment({
      depositRequestId,
      buyerId: depositRequest.buyerId,
      sellerId: depositRequest.sellerId,
      scheduledDate: appointmentDate,
      location: 'Văn phòng giao dịch - Địa chỉ sẽ được thông báo sau',
      status: 'PENDING',
      type: 'CONTRACT_SIGNING',
      notes: 'Hẹn ký hợp đồng mua bán xe',
      rescheduledCount: 0,
      maxReschedules: 3,
      buyerConfirmed: false,
      sellerConfirmed: false
    });

    await appointment.save();

    // TODO: Tạo transaction record khi có WalletTransaction model
    // TODO: Gửi thông báo cho buyer và seller về appointment

    return { buyerWallet, escrowAccount, appointment };
  }

  // Hoàn tiền từ Escrow về ví (khi người bán từ chối)
  async refundFromEscrow(depositRequestId: string) {
    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      throw new Error('Không tìm thấy yêu cầu đặt cọc');
    }

    const buyerWallet = await this.getWallet(depositRequest.buyerId);
    
    // Hoàn tiền về ví người mua
    buyerWallet.balance += depositRequest.depositAmount;
    buyerWallet.lastTransactionAt = new Date();
    
    await buyerWallet.save();

    // Cập nhật trạng thái deposit request
    depositRequest.status = 'SELLER_CANCELLED';
    depositRequest.sellerCancelledAt = new Date();
    await depositRequest.save();

    // TODO: Tạo transaction record khi có WalletTransaction model

    return buyerWallet;
  }

  // Hoàn thành giao dịch - Chuyển tiền từ Escrow về hệ thống
  async completeTransaction(depositRequestId: string) {
    const depositRequest = await DepositRequest.findById(depositRequestId);
    if (!depositRequest) {
      throw new Error('Không tìm thấy yêu cầu đặt cọc');
    }

    const escrowAccount = await EscrowAccount.findOne({ depositRequestId });
    if (!escrowAccount) {
      throw new Error('Không tìm thấy tài khoản Escrow');
    }

    // Cập nhật trạng thái Escrow
    escrowAccount.status = 'RELEASED';
    escrowAccount.releasedAt = new Date();
    await escrowAccount.save();

    // Cập nhật trạng thái deposit request
    depositRequest.status = 'COMPLETED';
    await depositRequest.save();

    // Chuyển tiền vào ví hệ thống
    await this.addToSystemWallet(escrowAccount.amount);

    return { depositRequest, escrowAccount };
  }

  // Tạo link nạp tiền qua VNPay
  async createDepositUrl(userId: string, amount: number, description: string, req: Request) {
    const result = await createVNPayOrder(amount, userId, description, req);
    return result.paymentUrl; // Trả về URL thanh toán
  }

  // Xử lý callback từ VNPay
  async handleVNPayCallback(query: any) {
    const result = await handleVNPayReturn(query);
    
    if (result && typeof result === 'object' && 'success' in result && result.success) {
      // Nạp tiền vào ví
      await this.deposit(
        (result as any).userId, 
        (result as any).amount, 
        'Nạp tiền qua VNPay'
      );
    }

    return result;
  }

  // Thêm tiền vào ví hệ thống
  async addToSystemWallet(amount: number) {
    let systemWallet = await SystemWallet.findOne();
    
    if (!systemWallet) {
      systemWallet = new SystemWallet({
        balance: 0,
        totalEarned: 0,
        totalTransactions: 0
      });
    }

    systemWallet.balance += amount;
    systemWallet.totalEarned += amount;
    systemWallet.totalTransactions += 1;
    systemWallet.lastTransactionAt = new Date();

    await systemWallet.save();
    return systemWallet;
  }

  // Lấy thông tin ví hệ thống
  async getSystemWallet() {
    let systemWallet = await SystemWallet.findOne();
    
    if (!systemWallet) {
      systemWallet = await this.addToSystemWallet(0);
    }

    return systemWallet;
  }
}

export default new WalletService();
