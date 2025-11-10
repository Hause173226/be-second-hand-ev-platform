import { Request, Response } from "express";
import SystemWalletService from "../services/systemWalletService";

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
