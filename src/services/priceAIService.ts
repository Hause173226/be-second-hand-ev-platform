/**
 * Heuristic + hook để sau này cắm model thật.
 * Đầu vào: { type, year, mileageKm, batteryCapacityKWh, condition, make, model }
 */
type Input = {
  type: "Car" | "Battery";
  year?: number;
  mileageKm?: number;
  batteryCapacityKWh?: number;
  condition?: "New" | "LikeNew" | "Used" | "Worn";
  make?: string;
  model?: string;
};

export const priceAIService = {
  async suggest(input: Input) {
    // baseline theo loại
    let base = input.type === "Car" ? 20000 : 2000; // USD

    // năm sản xuất (khấu hao ~5%/năm sau 3 năm)
    const now = new Date().getFullYear();
    if (input.year) {
      const age = Math.max(0, now - input.year);
      if (age > 3) base *= Math.pow(0.95, age - 3);
    }

    // mileage (mỗi 10k km trừ 3%)
    if (input.mileageKm && input.type === "Car") {
      const blocks = Math.floor(input.mileageKm / 10000);
      base *= Math.pow(0.97, blocks);
    }

    // batteryCapacity (mỗi 10kWh tăng 4%)
    if (input.batteryCapacityKWh) {
      const blocks = Math.floor(input.batteryCapacityKWh / 10);
      base *= 1 + blocks * 0.04;
    }

    // condition factor
    const condFactor = {
      New: 1.15, LikeNew: 1.0, Used: 0.85, Worn: 0.7,
    } as const;
    if (input.condition) base *= condFactor[input.condition];

    // hiệu chỉnh theo make/model (ví dụ)
    const premiumBrands = ["Tesla", "BMW", "Mercedes"];
    if (input.make && premiumBrands.includes(input.make)) base *= 1.08;

    // range ±7%
    const low = Math.round(base * 0.93);
    const high = Math.round(base * 1.07);
    const suggested = Math.round((low + high) / 2);

    return {
      suggested,
      range: { low, high },
      currency: "USD",
      factors: {
        type: input.type, year: input.year, mileageKm: input.mileageKm,
        batteryCapacityKWh: input.batteryCapacityKWh, condition: input.condition,
        make: input.make, model: input.model,
      },
      note: "Heuristic estimate. Có thể thay bằng model AI sau này.",
    };
  },
};
