import { MembershipPackage } from "../models/MembershipPackage";

export const seedMembershipPackages = async () => {
  try {
    const packages = [
      {
        name: "Free",
        slug: "free",
        description: "Gói miễn phí - Đăng tối đa 3 bài (Vĩnh viễn)",
        price: 0,
        duration: 0, // ✅ 0 = Vĩnh viễn (thay vì 365)
        features: {
          maxListings: 3,
          prioritySupport: false,
          featuredListing: false,
          autoRenew: false,
          badge: "",
        },
        isActive: true,
        isPermanent: true, // ✅ THÊM FIELD NÀY
        displayOrder: 1,
      },
      {
        name: "Basic",
        slug: "basic",
        description: "Gói cơ bản - 10 bài đăng/tháng",
        price: 99000, // 99k VND
        duration: 30,
        features: {
          maxListings: 10,
          prioritySupport: false,
          featuredListing: false,
          autoRenew: true,
          badge: "🔷 Basic",
        },
        isActive: true,
        isPermanent: false, // ✅ THÊM FIELD NÀY
        displayOrder: 2,
      },
      {
        name: "Premium",
        slug: "premium",
        description:
          "Gói cao cấp - 50 bài/tháng + Tin nổi bật + Hỗ trợ ưu tiên",
        price: 299000, // 299k VND
        duration: 30,
        features: {
          maxListings: 50,
          prioritySupport: true,
          featuredListing: true,
          autoRenew: true,
          badge: "⭐ Premium",
        },
        isActive: true,
        isPermanent: false, // ✅ THÊM FIELD NÀY
        displayOrder: 3,
      },
      {
        name: "VIP",
        slug: "vip",
        description: "Gói VIP - Không giới hạn + Tin nổi bật + Hỗ trợ 24/7",
        price: 599000, // 599k VND
        duration: 30,
        features: {
          maxListings: -1, // Unlimited
          prioritySupport: true,
          featuredListing: true,
          autoRenew: true,
          badge: "👑 VIP",
        },
        isActive: true,
        isPermanent: false, // ✅ THÊM FIELD NÀY
        displayOrder: 4,
      },
    ];

    for (const pkg of packages) {
      await MembershipPackage.findOneAndUpdate({ slug: pkg.slug }, pkg, {
        upsert: true,
        new: true,
      });
    }

    console.log(
      `✅ Seeded ${packages.length} membership packages successfully`
    );
    return packages.length;
  } catch (error) {
    console.error("❌ Error seeding membership packages:", error);
    throw error;
  }
};
