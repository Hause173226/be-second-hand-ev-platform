import { Request, Response } from "express";
import SystemWalletService from "../services/systemWalletService";
import SystemWalletTransaction from "../models/SystemWalletTransaction";

// [SYSTEM_WALLET_API] - Admin xem thông tin ví hệ thống
export const getSystemWalletInfo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const isAdmin = req.user?.role === "admin" || req.user?.role === "staff";
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: "Chỉ admin/staff mới có quyền xem ví hệ thống",
      });
      return;
    }

    const walletDoc = await SystemWalletService.getSystemWallet();
    const walletObject = walletDoc.toObject();

    // Tính tổng phí từ các giao dịch CANCELLED (20% phí hủy)
    const totalCancellationFees = await SystemWalletTransaction.aggregate([
      { $match: { type: "CANCELLED" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const cancellationFees = totalCancellationFees[0]?.total || 0;

    // Tính tổng doanh thu từ các giao dịch COMPLETED (100% tiền đặt cọc)
    const totalCompletedRevenue = await SystemWalletTransaction.aggregate([
      { $match: { type: "COMPLETED" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const completedRevenue = totalCompletedRevenue[0]?.total || 0;

    res.json({
      success: true,
      data: {
        id: walletObject._id?.toString(),
        balance: walletObject.balance,
        totalEarned: walletObject.totalEarned,
        totalTransactions: walletObject.totalTransactions,
        lastTransactionAt: walletObject.lastTransactionAt,
        createdAt: walletObject.createdAt,
        updatedAt: walletObject.updatedAt,
        // Thống kê chi tiết
        stats: {
          totalRevenue: completedRevenue, // Tổng doanh thu (giao dịch hoàn thành)
          totalFees: cancellationFees, // Tổng phí thu được (phí hủy 20%)
        },
      },
    });
    return;
  } catch (error) {
    console.error("Error getting system wallet info:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return;
  }
};

// [SYSTEM_WALLET_API] - Admin xem lịch sử giao dịch ví hệ thống
export const getSystemWalletTransactions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const isAdmin = req.user?.role === "admin" || req.user?.role === "staff";
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: "Chỉ admin/staff mới có quyền xem lịch sử giao dịch",
      });
      return;
    }

    const { type, page = 1, limit = 20 } = req.query;

    const result = await SystemWalletService.getTransactionHistory({
      type: type as "COMPLETED" | "CANCELLED" | undefined,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: result.transactions,
      pagination: result.pagination,
    });
    return;
  } catch (error) {
    console.error("Error getting system wallet transactions:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return;
  }
};
