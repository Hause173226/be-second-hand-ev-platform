import { Request, Response, NextFunction } from "express";
import { membershipService } from "../services/membershipService";

/**
 * Middleware kiểm tra giới hạn đăng tin theo gói membership
 * Chặn nếu user đã đạt giới hạn maxListings
 */
export const checkListingLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized - Vui lòng đăng nhập",
      });
      return;
    }

    // ✅ Gọi service kiểm tra giới hạn
    const result = await membershipService.canCreateListing(userId);

    // ❌ Nếu đã đạt giới hạn → Chặn
    if (!result.canCreate) {
      res.status(403).json({
        success: false,
        message:
          result.reason ||
          `Bạn đã đạt giới hạn đăng tin (${result.current}/${
            result.max === -1 ? "∞" : result.max
          }). Vui lòng nâng cấp gói membership để đăng thêm.`,
        data: {
          currentListings: result.current,
          maxListings: result.max,
          remainingSlots:
            result.max === -1 ? -1 : Math.max(0, result.max - result.current),
          packageName: result.packageName,
          suggestedAction: "UPGRADE_MEMBERSHIP",
          upgradeUrl: "/api/memberships/packages",
        },
      });
      return;
    }

    // ✅ Còn slot → Cho phép tạo listing
    const remaining = result.max === -1 ? "∞" : result.max - result.current;
    console.log(
      `✅ User ${userId} can create listing (${remaining} slots remaining, package: ${result.packageName})`
    );

    next();
  } catch (error: any) {
    console.error("checkListingLimit error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi kiểm tra giới hạn đăng tin",
    });
  }
};
