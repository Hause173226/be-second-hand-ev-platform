// src/services/systemWalletService.ts
import SystemWallet from "../models/SystemWallet";
import SystemWalletTransaction from "../models/SystemWalletTransaction";
import Appointment from "../models/Appointment";
import DepositRequest from "../models/DepositRequest";
import Listing from "../models/Listing";
import { User } from "../models/User";

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

      // Debug logging
      console.log(`[SystemWallet] Query:`, JSON.stringify(query));
      console.log(
        `[SystemWallet] Found ${transactions.length} transactions, total: ${total}`
      );

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

  /**
   * Lấy chi tiết một giao dịch cụ thể của ví hệ thống
   * @param transactionId ID của giao dịch
   */
  public async getTransactionDetail(transactionId: string) {
    try {
      const transaction = await SystemWalletTransaction.findById(
        transactionId
      ).lean();

      if (!transaction) {
        throw new Error("Giao dịch không tồn tại");
      }

      const result: any = {
        id: transaction._id.toString(),
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        balanceAfter: transaction.balanceAfter,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        appointment: null,
        depositRequest: null,
      };

      // Populate appointment nếu có
      if (transaction.appointmentId) {
        const appointment = await Appointment.findById(
          transaction.appointmentId
        ).lean();

        if (appointment) {
          // Populate buyer và seller
          const buyer = await User.findById(appointment.buyerId)
            .select("_id fullName email phone avatar")
            .lean();
          const seller = await User.findById(appointment.sellerId)
            .select("_id fullName email phone avatar")
            .lean();

          // Populate depositRequest nếu có
          let depositRequest = null;
          if (appointment.depositRequestId) {
            depositRequest = await DepositRequest.findById(
              appointment.depositRequestId
            ).lean();

            // Populate listing từ depositRequest
            let listing = null;
            if (depositRequest?.listingId) {
              listing = await Listing.findById(depositRequest.listingId)
                .select("_id title price images make model year condition type")
                .lean();
            }

            result.depositRequest = {
              id: depositRequest?._id?.toString(),
              listingId: depositRequest?.listingId,
              buyerId: depositRequest?.buyerId,
              sellerId: depositRequest?.sellerId,
              depositAmount: depositRequest?.depositAmount,
              status: depositRequest?.status,
              listing: listing
                ? {
                    id: listing._id?.toString(),
                    title: (listing as any).title,
                    price: (listing as any).price,
                    images: (listing as any).images,
                    make: (listing as any).make,
                    model: (listing as any).model,
                    year: (listing as any).year,
                    condition: (listing as any).condition,
                    type: (listing as any).type,
                  }
                : null,
              createdAt: depositRequest?.createdAt,
              updatedAt: depositRequest?.updatedAt,
            };
          }

          result.appointment = {
            id: appointment._id?.toString(),
            appointmentType: appointment.appointmentType,
            buyerId: appointment.buyerId,
            sellerId: appointment.sellerId,
            buyer: buyer
              ? {
                  id: buyer._id?.toString(),
                  fullName: (buyer as any).fullName,
                  email: (buyer as any).email,
                  phone: (buyer as any).phone,
                  avatar: (buyer as any).avatar,
                }
              : null,
            seller: seller
              ? {
                  id: seller._id?.toString(),
                  fullName: (seller as any).fullName,
                  email: (seller as any).email,
                  phone: (seller as any).phone,
                  avatar: (seller as any).avatar,
                }
              : null,
            scheduledDate: appointment.scheduledDate,
            status: appointment.status,
            type: appointment.type,
            location: appointment.location,
            notes: appointment.notes,
            completedAt: appointment.completedAt,
            cancelledAt: appointment.cancelledAt,
            createdAt: appointment.createdAt,
            updatedAt: appointment.updatedAt,
          };
        }
      } else if (transaction.depositRequestId) {
        // Nếu không có appointment nhưng có depositRequest
        const depositRequest = await DepositRequest.findById(
          transaction.depositRequestId
        ).lean();

        if (depositRequest) {
          // Populate listing
          let listing = null;
          if (depositRequest.listingId) {
            listing = await Listing.findById(depositRequest.listingId)
              .select("_id title price images make model year condition type")
              .lean();
          }

          // Populate buyer và seller
          const buyer = await User.findById(depositRequest.buyerId)
            .select("_id fullName email phone avatar")
            .lean();
          const seller = await User.findById(depositRequest.sellerId)
            .select("_id fullName email phone avatar")
            .lean();

          result.depositRequest = {
            id: depositRequest._id?.toString(),
            listingId: depositRequest.listingId,
            buyerId: depositRequest.buyerId,
            sellerId: depositRequest.sellerId,
            depositAmount: depositRequest.depositAmount,
            status: depositRequest.status,
            listing: listing
              ? {
                  id: listing._id?.toString(),
                  title: (listing as any).title,
                  price: (listing as any).price,
                  images: (listing as any).images,
                  make: (listing as any).make,
                  model: (listing as any).model,
                  year: (listing as any).year,
                  condition: (listing as any).condition,
                  type: (listing as any).type,
                }
              : null,
            buyer: buyer
              ? {
                  id: buyer._id?.toString(),
                  fullName: (buyer as any).fullName,
                  email: (buyer as any).email,
                  phone: (buyer as any).phone,
                  avatar: (buyer as any).avatar,
                }
              : null,
            seller: seller
              ? {
                  id: seller._id?.toString(),
                  fullName: (seller as any).fullName,
                  email: (seller as any).email,
                  phone: (seller as any).phone,
                  avatar: (seller as any).avatar,
                }
              : null,
            createdAt: depositRequest.createdAt,
            updatedAt: depositRequest.updatedAt,
          };
        }
      }

      return result;
    } catch (error) {
      console.error("Error getting transaction detail:", error);
      throw error;
    }
  }

  /**
   * Lấy dữ liệu thống kê giao dịch theo thời gian để vẽ chart
   * @param filters Bộ lọc: period (day/month/year), startDate, endDate
   */
  public async getTransactionChartData(
    filters: {
      period?: "day" | "month" | "year";
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    try {
      const { period = "day", startDate, endDate } = filters;

      // Tạo query filter theo thời gian
      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.$gte = startDate;
        }
        if (endDate) {
          dateFilter.createdAt.$lte = endDate;
        }
      }

      // Nếu không có startDate/endDate, mặc định lấy 30 ngày gần nhất
      if (!startDate && !endDate) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFilter.createdAt = { $gte: thirtyDaysAgo };
      }

      // Tạo format date theo period
      let dateFormat: any;
      if (period === "day") {
        dateFormat = {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
          },
        };
      } else if (period === "month") {
        dateFormat = {
          $dateToString: {
            format: "%Y-%m",
            date: "$createdAt",
          },
        };
      } else {
        // year
        dateFormat = {
          $dateToString: {
            format: "%Y",
            date: "$createdAt",
          },
        };
      }

      // Aggregate để group theo thời gian và loại giao dịch
      const chartData = await SystemWalletTransaction.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              date: dateFormat,
              type: "$type",
            },
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.date": 1 },
        },
      ]);

      // Debug logging
      console.log(
        `[SystemWallet Chart] Date filter:`,
        JSON.stringify(dateFilter)
      );
      console.log(`[SystemWallet Chart] Found ${chartData.length} groups`);

      // Format lại dữ liệu để dễ dùng cho chart
      const formattedData: any = {
        labels: [],
        datasets: [
          {
            label: "Doanh thu (COMPLETED)",
            data: [],
            backgroundColor: "rgba(34, 197, 94, 0.2)",
            borderColor: "rgba(34, 197, 94, 1)",
            borderWidth: 2,
          },
          {
            label: "Phí hủy (CANCELLED)",
            data: [],
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            borderColor: "rgba(239, 68, 68, 1)",
            borderWidth: 2,
          },
        ],
        summary: {
          totalRevenue: 0,
          totalFees: 0,
          totalTransactions: 0,
        },
      };

      // Tạo map để track các ngày đã có
      const dateMap = new Map<
        string,
        { completed: number; cancelled: number }
      >();

      chartData.forEach((item) => {
        const date = item._id.date;
        const type = item._id.type;
        const amount = item.totalAmount;

        if (!dateMap.has(date)) {
          dateMap.set(date, { completed: 0, cancelled: 0 });
        }

        const dateData = dateMap.get(date)!;
        if (type === "COMPLETED") {
          dateData.completed = amount;
          formattedData.summary.totalRevenue += amount;
        } else if (type === "CANCELLED") {
          dateData.cancelled = amount;
          formattedData.summary.totalFees += amount;
        }
        formattedData.summary.totalTransactions += item.count;
      });

      // Sắp xếp và format lại dữ liệu
      const sortedDates = Array.from(dateMap.keys()).sort();
      sortedDates.forEach((date) => {
        formattedData.labels.push(date);
        const dateData = dateMap.get(date)!;
        formattedData.datasets[0].data.push(dateData.completed);
        formattedData.datasets[1].data.push(dateData.cancelled);
      });

      return formattedData;
    } catch (error) {
      console.error("Error getting transaction chart data:", error);
      throw error;
    }
  }
}

export default SystemWalletService.getInstance();
