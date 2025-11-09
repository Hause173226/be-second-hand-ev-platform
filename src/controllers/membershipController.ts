import { Request, Response } from "express";
import { membershipService } from "../services/membershipService";
import { MembershipPackage } from "../models/MembershipPackage";
import walletService from "../services/walletService";
import { Payment } from "../models/Payment";
import mongoose from "mongoose";
import { calculateRenewPricing } from "../utils/pricingCalculator";
import { User } from "../models/User";

export const membershipController = {
  /**
   * GET /api/memberships/packages
   * Lấy danh sách các gói membership
   */
  getPackages: async (req: Request, res: Response): Promise<void> => {
    try {
      const packages = await membershipService.getAllPackages();

      res.json({
        success: true,
        data: packages,
      });
    } catch (error: any) {
      console.error("Get packages error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi lấy danh sách gói",
      });
    }
  },

  /**
   * GET /api/memberships/current
   * Lấy gói membership hiện tại của user
   */
  getCurrentMembership: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const membership = await membershipService.getCurrentMembership(userId);

      res.json({
        success: true,
        data: membership,
      });
    } catch (error: any) {
      console.error("Get current membership error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi lấy thông tin gói",
      });
    }
  },

  /**
   * GET /api/memberships/check-limit
   * Kiểm tra giới hạn đăng bài
   */
  checkListingLimit: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const result = await membershipService.canCreateListing(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("Check listing limit error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi kiểm tra giới hạn",
      });
    }
  },

  /**
   * POST /api/memberships/purchase
   * Mua gói membership
   */
  purchasePackage: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const { packageId, paymentMethod } = req.body;
      const { confirm } = req.query;

      if (!packageId) {
        res.status(400).json({
          success: false,
          message: "packageId là bắt buộc",
        });
        return;
      }

      const pkg = await MembershipPackage.findById(packageId);
      if (!pkg) {
        res.status(404).json({
          success: false,
          message: "Gói không tồn tại",
        });
        return;
      }

      // ✅ Kiểm tra confirm cho upgrade/downgrade
      if (confirm !== "true") {
        const currentMembership = await membershipService.getCurrentMembership(
          userId
        );

        if (currentMembership) {
          const currentPkg = await MembershipPackage.findById(
            currentMembership.packageId
          );

          if (currentPkg) {
            const isSamePackage = currentPkg.slug === pkg.slug;

            if (isSamePackage) {
              if (currentMembership.endDate) {
                const now = new Date();
                const daysRemaining = Math.ceil(
                  (currentMembership.endDate.getTime() - now.getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                if (daysRemaining > 0) {
                  res.status(409).json({
                    success: false,
                    message: `Bạn đã mua gói ${currentPkg.name} trước đó và còn ${daysRemaining} ngày. Bạn có muốn gia hạn gói không?`,
                    data: {
                      currentPackage: currentPkg.name,
                      daysRemaining,
                      endDate: currentMembership.endDate,
                      suggestedAction: "RENEW",
                    },
                  });
                  return;
                }
              } else {
                res.status(409).json({
                  success: false,
                  message: `Bạn đang dùng gói ${currentPkg.name} (vĩnh viễn). Không cần mua lại.`,
                  data: {
                    currentPackage: currentPkg.name,
                    isPermanent: true,
                  },
                });
                return;
              }
            } else {
              const isUpgrade = pkg.price > currentPkg.price;
              const isDowngrade = pkg.price < currentPkg.price;

              let action: string;
              let actionType: string;
              let warningMessage: string;

              if (isUpgrade) {
                action = "UPGRADE";
                actionType = "nâng cấp";
                warningMessage = `
                • Gói ${currentPkg.name} hiện tại sẽ bị hủy ngay lập tức
                • Bạn sẽ mất ${Math.ceil(
                  (currentMembership.endDate!.getTime() -
                    new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                )} ngày còn lại
                • Gói ${pkg.name} sẽ được kích hoạt với ${pkg.duration} ngày mới
                • Bạn sẽ có đầy đủ tính năng của gói ${pkg.name}
              `;
              } else if (isDowngrade) {
                action = "DOWNGRADE";
                actionType = "hạ cấp";
                warningMessage = `
                • Gói ${currentPkg.name} hiện tại sẽ bị hủy ngay lập tức
                • Bạn sẽ mất ${Math.ceil(
                  (currentMembership.endDate!.getTime() -
                    new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                )} ngày còn lại
                • Gói ${pkg.name} sẽ được kích hoạt với ${pkg.duration} ngày mới
                • Một số tính năng sẽ bị giới hạn
              `;
              } else {
                action = "SWITCH";
                actionType = "chuyển đổi";
                warningMessage = `
                • Gói ${currentPkg.name} hiện tại sẽ bị hủy ngay lập tức
                • Bạn sẽ mất ${Math.ceil(
                  (currentMembership.endDate!.getTime() -
                    new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                )} ngày còn lại
                • Gói ${pkg.name} sẽ được kích hoạt với ${pkg.duration} ngày mới
              `;
              }

              res.status(200).json({
                success: true,
                message: `Bạn đang dùng gói ${currentPkg.name}. Xác nhận ${actionType} sang gói ${pkg.name}?`,
                data: {
                  currentPackage: {
                    name: currentPkg.name,
                    slug: currentPkg.slug,
                    price: currentPkg.price,
                    endDate: currentMembership.endDate,
                    daysRemaining: Math.ceil(
                      (currentMembership.endDate!.getTime() -
                        new Date().getTime()) /
                        (1000 * 60 * 60 * 24)
                    ),
                    features: currentPkg.features,
                  },
                  newPackage: {
                    name: pkg.name,
                    slug: pkg.slug,
                    price: pkg.price,
                    duration: pkg.duration,
                    features: pkg.features,
                  },
                  action,
                  actionType,
                  warning: warningMessage,
                  confirmRequired: true,
                },
              });
              return;
            }
          }
        }
      }

      // ✅ Gói FREE → Kích hoạt ngay
      if (pkg.price === 0 || pkg.isPermanent) {
        const membership = await membershipService.purchasePackage(
          userId,
          packageId
        );

        res.json({
          success: true,
          data: membership,
          message: "Đã kích hoạt gói miễn phí thành công",
        });
        return;
      }

      // ✅ GÓI TRẢ PHÍ - KIỂM TRA VÍ
      const Wallet = mongoose.model("Wallet"); // ✅ FIX: Wallet thay vì SystemWallet
      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        res.status(404).json({
          success: false,
          message: "Ví không tồn tại",
        });
        return;
      }

      const walletBalance = wallet.balance || 0;
      const packagePrice = pkg.price;

      // ✅ OPTION 1: Thanh toán bằng ví (nếu chọn WALLET hoặc đủ tiền)
      if (
        paymentMethod === "WALLET" ||
        (walletBalance >= packagePrice && !paymentMethod)
      ) {
        // Kiểm tra số dư
        if (walletBalance < packagePrice) {
          res.status(400).json({
            success: false,
            message: `Số dư ví không đủ. Cần ${packagePrice.toLocaleString()}đ, hiện có ${walletBalance.toLocaleString()}đ`,
            data: {
              required: packagePrice,
              current: walletBalance,
              shortage: packagePrice - walletBalance,
              suggestedAction: "USE_VNPAY",
            },
          });
          return;
        }

        // ✅ Trừ tiền ví
        wallet.balance -= packagePrice;
        wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + packagePrice;
        wallet.lastTransactionAt = new Date();
        await wallet.save();

        // Tạo payment record
        const payment = await Payment.create({
          userId,
          amount: packagePrice,
          description: `Mua gói ${pkg.name}`,
          status: "COMPLETED",
          method: "WALLET",
          metadata: {
            type: "MEMBERSHIP",
            packageId,
          },
        });

        // Kích hoạt membership
        const membership = await membershipService.purchasePackage(
          userId,
          packageId,
          String(payment._id),
          `WALLET_${Date.now()}`
        );

        res.json({
          success: true,
          data: {
            membership,
            payment: {
              method: "WALLET",
              amount: packagePrice,
              newBalance: wallet.balance,
            },
          },
          message: `Đã mua gói ${pkg.name} thành công bằng ví`,
        });
        return;
      }

      // ✅ OPTION 2: Thanh toán qua VNPay
      const payment = await Payment.create({
        userId,
        amount: packagePrice,
        description: `Mua gói ${pkg.name}`,
        status: "PENDING",
        method: "VNPAY",
        metadata: {
          type: "MEMBERSHIP",
          packageId,
        },
      });

      const { vnpUrl, orderId } = await walletService.createPaymentUrl(
        userId,
        packagePrice,
        `Mua gói ${pkg.name}`,
        req
      );

      payment.transactionId = orderId;
      await payment.save();

      res.json({
        success: true,
        data: {
          paymentUrl: vnpUrl,
          paymentId: String(payment._id),
          orderId,
          package: {
            _id: pkg._id,
            name: pkg.name,
            slug: pkg.slug,
            price: pkg.price,
            duration: pkg.duration,
            description: pkg.description,
          },
        },
        message: "Đã tạo link thanh toán VNPay",
      });
    } catch (error: any) {
      console.error("Purchase package error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi mua gói",
      });
    }
  },

  /**
   * GET /api/memberships/vnpay-return
   * Callback từ VNPay sau khi thanh toán
   */
  handleVNPayReturn: async (req: Request, res: Response): Promise<void> => {
    try {
      const { vnp_TxnRef, vnp_ResponseCode, vnp_TransactionNo } = req.query;

      if (vnp_ResponseCode !== "00") {
        res.redirect(
          `http://localhost:5173/membership/payment-result?success=false&code=${vnp_ResponseCode}`
        );
        return;
      }

      const payment = await Payment.findOne({ transactionId: vnp_TxnRef });

      if (!payment) {
        res.redirect(
          `http://localhost:5173/membership/payment-result?success=false&error=payment_not_found`
        );
        return;
      }

      if (payment.status === "COMPLETED") {
        res.redirect(
          `http://localhost:5173/membership/payment-result?success=true&amount=${payment.amount}`
        );
        return;
      }

      payment.status = "COMPLETED";
      await payment.save();

      // Kích hoạt membership
      if (payment.metadata?.packageId) {
        if (payment.metadata.type === "MEMBERSHIP_RENEW") {
          // ✅ Lấy months từ metadata
          const months = payment.metadata.months || 1;

          await membershipService.renewMembership(
            String(payment.userId),
            String(payment._id),
            vnp_TransactionNo as string,
            months // ✅ Truyền months
          );
        } else {
          await membershipService.purchasePackage(
            String(payment.userId),
            payment.metadata.packageId,
            String(payment._id),
            vnp_TransactionNo as string
          );
        }
      }

      res.redirect(
        `http://localhost:5173/membership/payment-result?success=true&amount=${payment.amount}`
      );
    } catch (error: any) {
      console.error("VNPay return error:", error);
      res.redirect(
        `http://localhost:5173/membership/payment-result?success=false&error=${encodeURIComponent(
          error.message
        )}`
      );
    }
  },

  /**
   * POST /api/memberships/renew
   * Gia hạn gói membership
   */
  renewMembership: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const { months, paymentMethod } = req.body; // ✅ THÊM paymentMethod

      // ✅ Validate months
      const validMonths = [1, 3, 6, 12];
      if (!months || !validMonths.includes(months)) {
        res.status(400).json({
          success: false,
          message: "months phải là 1, 3, 6 hoặc 12",
        });
        return;
      }

      const currentMembership = await membershipService.getCurrentMembership(
        userId
      );
      if (!currentMembership) {
        res.status(404).json({
          success: false,
          message: "Không tìm thấy gói đang sử dụng",
        });
        return;
      }

      const pkg = await MembershipPackage.findById(currentMembership.packageId);
      if (!pkg) {
        res.status(404).json({
          success: false,
          message: "Gói không tồn tại",
        });
        return;
      }

      // ✅ Tính giá theo số tháng + discount
      const pricing = calculateRenewPricing(pkg.price, months);

      // ✅ Nếu là gói FREE → Gia hạn ngay
      if (pkg.price === 0) {
        const membership = await membershipService.renewMembership(
          userId,
          undefined,
          undefined,
          months
        );
        res.json({
          success: true,
          data: membership,
          message: `Đã gia hạn gói miễn phí ${months} tháng`,
        });
        return;
      }

      // ✅ GÓI TRẢ PHÍ - KIỂM TRA VÍ
      const Wallet = mongoose.model("Wallet");
      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        res.status(404).json({
          success: false,
          message: "Ví không tồn tại",
        });
        return;
      }

      const walletBalance = wallet.balance || 0;
      const renewPrice = pricing.finalPrice;

      // ✅ OPTION 1: Thanh toán bằng ví (nếu chọn WALLET hoặc đủ tiền)
      if (
        paymentMethod === "WALLET" ||
        (walletBalance >= renewPrice && !paymentMethod)
      ) {
        // Kiểm tra số dư
        if (walletBalance < renewPrice) {
          res.status(400).json({
            success: false,
            message: `Số dư ví không đủ. Cần ${renewPrice.toLocaleString()}đ, hiện có ${walletBalance.toLocaleString()}đ`,
            data: {
              required: renewPrice,
              current: walletBalance,
              shortage: renewPrice - walletBalance,
              suggestedAction: "USE_VNPAY",
            },
          });
          return;
        }

        // ✅ Trừ tiền ví
        wallet.balance -= renewPrice;
        wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + renewPrice;
        wallet.lastTransactionAt = new Date();
        await wallet.save();

        // Tạo payment record
        const payment = await Payment.create({
          userId,
          amount: renewPrice,
          description: `Gia hạn gói ${pkg.name} - ${months} tháng`,
          status: "COMPLETED",
          method: "WALLET",
          metadata: {
            type: "MEMBERSHIP_RENEW",
            packageId: String(pkg._id),
            months,
            pricing,
          },
        });

        // Gia hạn membership
        const membership = await membershipService.renewMembership(
          userId,
          String(payment._id),
          `WALLET_${Date.now()}`,
          months
        );

        res.json({
          success: true,
          data: {
            membership,
            payment: {
              method: "WALLET",
              amount: renewPrice,
              newBalance: wallet.balance,
            },
            pricing,
          },
          message: `Đã gia hạn gói ${pkg.name} ${months} tháng thành công bằng ví`,
        });
        return;
      }

      // ✅ OPTION 2: Thanh toán qua VNPay
      const payment = await Payment.create({
        userId,
        amount: renewPrice,
        description: `Gia hạn gói ${pkg.name} - ${months} tháng`,
        status: "PENDING",
        method: "VNPAY",
        metadata: {
          type: "MEMBERSHIP_RENEW",
          packageId: String(pkg._id),
          months,
          pricing,
        },
      });

      const { vnpUrl, orderId } = await walletService.createPaymentUrl(
        userId,
        renewPrice,
        `Gia hạn gói ${pkg.name} - ${months} tháng`,
        req
      );

      payment.transactionId = orderId;
      await payment.save();

      res.json({
        success: true,
        data: {
          paymentUrl: vnpUrl,
          paymentId: String(payment._id),
          orderId,
          pricing,
          package: {
            name: pkg.name,
            basePrice: pkg.price,
          },
        },
        message: "Đã tạo link thanh toán gia hạn",
      });
    } catch (error: any) {
      console.error("Renew membership error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi gia hạn gói",
      });
    }
  },

  /**
   * POST /api/memberships/cancel
   * Hủy gói membership
   */
  cancelMembership: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const { reason } = req.body;

      // Kiểm tra membership hiện tại
      const currentMembership = await membershipService.getCurrentMembership(
        userId
      );

      if (!currentMembership) {
        res.status(404).json({
          success: false,
          message: "Không tìm thấy gói đang sử dụng",
        });
        return;
      }

      const pkg = await MembershipPackage.findById(currentMembership.packageId);

      if (!pkg) {
        res.status(404).json({
          success: false,
          message: "Gói không tồn tại",
        });
        return;
      }

      // ✅ Không cho hủy gói FREE
      if (pkg.price === 0 || pkg.isPermanent) {
        res.status(400).json({
          success: false,
          message: "Không thể hủy gói miễn phí",
        });
        return;
      }

      // ✅ Tính số ngày đã dùng và ngày còn lại
      const now = new Date();
      const startDate = currentMembership.startDate;
      const endDate = currentMembership.endDate!;

      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const daysUsed = Math.ceil(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const daysRemaining = Math.max(
        0,
        Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      // ✅ Tính tiền hoàn trả (refund)
      const refundAmount =
        daysRemaining > 0
          ? Math.round((daysRemaining / totalDays) * pkg.price)
          : 0;

      // ✅ CHỈ UPDATE status, KHÔNG tạo membership mới
      currentMembership.isActive = false;
      currentMembership.status = "CANCELLED";
      await currentMembership.save();

      // ✅ Cập nhật User về gói FREE
      const freePackage = await MembershipPackage.findOne({ slug: "free" });
      if (freePackage) {
        await User.findByIdAndUpdate(userId, {
          currentMembership: freePackage._id,
          membershipBadge: freePackage.features.badge,
        });
      }

      // ✅ Tạo payment record cho refund (nếu có)
      if (refundAmount > 0) {
        await Payment.create({
          userId,
          amount: refundAmount,
          description: `Hoàn tiền hủy gói ${pkg.name} (${daysRemaining} ngày)`,
          status: "COMPLETED",
          method: "WALLET",
          metadata: {
            type: "REFUND",
            packageId: String(pkg._id),
            reason,
            daysUsed,
            daysRemaining,
            totalDays,
          },
        });

        // ✅ TODO: Cộng tiền vào ví (nếu có wallet system)
        // await walletService.addBalance(userId, refundAmount, 'REFUND');
      }

      res.json({
        success: true,
        data: {
          cancelledPackage: {
            name: pkg.name,
            slug: pkg.slug,
            price: pkg.price,
          },
          usage: {
            totalDays,
            daysUsed,
            daysRemaining,
            usagePercentage: Math.round((daysUsed / totalDays) * 100),
          },
          refund: {
            amount: refundAmount,
            method: "WALLET",
            processedAt: now,
          },
          downgradedTo: freePackage
            ? {
                name: freePackage.name,
                slug: freePackage.slug,
              }
            : null,
        },
        message:
          refundAmount > 0
            ? `Đã hủy gói ${
                pkg.name
              }. Hoàn trả ${refundAmount.toLocaleString()}đ vào ví.`
            : `Đã hủy gói ${pkg.name}.`,
      });
    } catch (error: any) {
      console.error("Cancel membership error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi hủy gói",
      });
    }
  },

  /**
   * GET /api/memberships/history
   * Lấy lịch sử membership
   */
  getMembershipHistory: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const history = await membershipService.getMembershipHistory(userId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      console.error("Get membership history error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi lấy lịch sử",
      });
    }
  },
};
