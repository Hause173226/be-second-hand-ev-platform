type Input = {
  type: "Car" | "Battery";
  year?: number;
  mileageKm?: number;
  batteryCapacityKWh?: number;
  condition?: "New" | "LikeNew" | "Used" | "Worn";
  make?: string;
  model?: string;
};

type Suggest = {
  suggested: number;
  range: { min: number; max: number };
  currency: "USD";
  confidence: "low" | "medium" | "high";
  factors: Record<string, unknown>;
  note: string;
};

export const priceAIService = {
  suggest(input: Input): Suggest {
    // 1) Baseline
    const baseFloor = input.type === "Car" ? 2000 : 500; // sàn an toàn
    let base = input.type === "Car" ? 20000 : 2000;      // USD

    // 2) Khấu hao theo năm: -5%/năm sau năm thứ 3
    const now = new Date().getFullYear();
    if (input.year) {
      const age = Math.max(0, now - input.year);
      if (age > 3) base *= Math.pow(0.95, age - 3);
    }

    // 3) Km: -3% mỗi 10k km (chỉ Car)
    if (input.type === "Car" && input.mileageKm) {
      const blocks = Math.floor(input.mileageKm / 10_000);
      base *= Math.pow(0.97, blocks);
    }

    // 4) Dung lượng pin: +4% mỗi 10kWh
    if (input.batteryCapacityKWh) {
      const blocks = Math.floor(input.batteryCapacityKWh / 10);
      base *= (1 + blocks * 0.04);
    }

    // 5) Tình trạng
    const condFactor = { New: 1.15, LikeNew: 1.0, Used: 0.85, Worn: 0.7 } as const;
    if (input.condition) base *= condFactor[input.condition];

    // 6) Thương hiệu (case-insensitive)
    const premiumBrands = ["tesla", "bmw", "mercedes"];
    if (input.make && premiumBrands.includes(input.make.toLowerCase())) {
      base *= 1.08;
    }

    // 7) Clamp & làm tròn đẹp
    const clamped = Math.max(baseFloor, base);
    const round100 = (n: number) => Math.round(n / 100) * 100;

    const min = round100(clamped * 0.93);
    const max = round100(clamped * 1.07);
    const suggested = round100((min + max) / 2);

    // 8) Confidence theo số feature đầu vào
    const filled = [
      input.year, input.mileageKm, input.batteryCapacityKWh,
      input.condition, input.make, input.model
    ].filter(v => v !== undefined && v !== null).length;

    const confidence: Suggest["confidence"] =
      filled >= 5 ? "high" : filled >= 3 ? "medium" : "low";

    return {
      suggested,
      range: { min, max },
      currency: "USD",
      confidence,
      factors: {
        ...input,
      },
      note: "Heuristic estimate; có thể thay bằng model AI sau.",
    };
  },
};
