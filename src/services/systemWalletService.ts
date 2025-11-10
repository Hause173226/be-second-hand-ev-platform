// src/services/systemWalletService.ts
import SystemWallet from "../models/SystemWallet";
import SystemWalletTransaction from "../models/SystemWalletTransaction";

export class SystemWalletService {
  private static instance: SystemWalletService;

  constructor() {}

  public static getInstance(): SystemWalletService {
    if (!SystemWalletService.instance) {
      SystemWalletService.instance = new SystemWalletService();
    }
    return SystemWalletService.instance;
  }

  /**
   * Lấy ví hệ thống (chỉ có 1 ví duy nhất)
   */
  public async getSystemWallet() {
    try {
      let systemWallet = await SystemWallet.findOne();

      // Nếu chưa có ví hệ thống, tạo mới
      if (!systemWallet) {
        systemWallet = new SystemWallet({
          balance: 0,
          totalEarned: 0,
          totalTransactions: 0,
        });
        await systemWallet.save();
        console.log("✅ Created new SystemWallet");
      }

      return systemWallet;
    } catch (error) {
      console.error("Error getting system wallet:", error);
      throw error;
    }
  }

  /**
   * Tăng số dư ví hệ thống (nhận tiền từ giao dịch)
   * @param amount Số tiền nhận được
   * @param description Mô tả giao dịch
   * @param type Loại giao dịch: 'COMPLETED' (100%) hoặc 'CANCELLED' (20% phí hủy)
   * @param depositRequestId ID của deposit request (optional)
   * @param appointmentId ID của appointment (optional)
   */
  public async deposit(
    amount: number,
    description: string,
    type: "COMPLETED" | "CANCELLED" = "COMPLETED",
    depositRequestId?: string,
    appointmentId?: string
  ) {
    try {
      const systemWallet = await this.getSystemWallet();

      systemWallet.balance += amount;
      systemWallet.totalEarned += amount;
      systemWallet.totalTransactions += 1;
      systemWallet.lastTransactionAt = new Date();

      await systemWallet.save();

      // Lưu lịch sử giao dịch
      await SystemWalletTransaction.create({
        type,
        amount,
        depositRequestId,
        appointmentId,
        description,
        balanceAfter: systemWallet.balance,
      });

      console.log(`✅ System wallet: +${amount} VND - ${description}`);
      console.log(`💰 System balance: ${systemWallet.balance} VND`);

      return systemWallet;
    } catch (error) {
      console.error("Error depositing to system wallet:", error);
      throw error;
    }
  }

  /**
   * Rút tiền từ ví hệ thống
   */
  public async withdraw(amount: number, description: string) {
    try {
      const systemWallet = await this.getSystemWallet();

      if (systemWallet.balance < amount) {
        throw new Error("Số dư ví hệ thống không đủ");
      }

      systemWallet.balance -= amount;
      systemWallet.totalTransactions += 1;
      systemWallet.lastTransactionAt = new Date();

      await systemWallet.save();

      console.log(`✅ System wallet: -${amount} VND - ${description}`);
      console.log(`💰 System balance: ${systemWallet.balance} VND`);

      return systemWallet;
    } catch (error) {
      console.error("Error withdrawing from system wallet:", error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử giao dịch (tùy chọn - có thể mở rộng)
   */
  public async getStats() {
    try {
      const systemWallet = await this.getSystemWallet();

      return {
        balance: systemWallet.balance,
        totalEarned: systemWallet.totalEarned,
        totalTransactions: systemWallet.totalTransactions,
        lastTransactionAt: systemWallet.lastTransactionAt,
      };
    } catch (error) {
      console.error("Error getting system wallet stats:", error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử giao dịch của ví hệ thống
   * @param filters Bộ lọc: type, page, limit
   */
  public async getTransactionHistory(
    filters: {
      type?: "COMPLETED" | "CANCELLED";
      page?: number;
      limit?: number;
    } = {}
  ) {
    try {
      const { type, page = 1, limit = 20 } = filters;

      const query: any = {};
      if (type) {
        query.type = type;
      }

      const transactions = await SystemWalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await SystemWalletTransaction.countDocuments(query);

      return {
        transactions: transactions.map((tx) => ({
          id: tx._id.toString(),
          type: tx.type,
          amount: tx.amount,
          depositRequestId: tx.depositRequestId,
          appointmentId: tx.appointmentId,
          description: tx.description,
          balanceAfter: tx.balanceAfter,
          createdAt: tx.createdAt,
          updatedAt: tx.updatedAt,
        })),
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit,
        },
      };
    } catch (error) {
      console.error("Error getting transaction history:", error);
      throw error;
    }
  }
}

export default SystemWalletService.getInstance();
