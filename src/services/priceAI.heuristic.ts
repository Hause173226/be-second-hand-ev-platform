import { PriceAIInput, PriceAISuggest } from "./priceAI.types";

export function suggestHeuristic(input: PriceAIInput): PriceAISuggest {
  const baseFloor = input.type === "Car" ? 2000 : 500;
  let base = input.type === "Car" ? 20000 : 2000;

  const now = new Date().getFullYear();
  if (input.year) {
    const age = Math.max(0, now - input.year);
    if (age > 3) base *= Math.pow(0.95, age - 3); // -5%/năm sau năm 3
  }
  if (input.type === "Car" && input.mileageKm) {
    const blocks = Math.floor(input.mileageKm / 10_000);
    base *= Math.pow(0.97, blocks);               // -3% mỗi 10k km
  }
  if (input.batteryCapacityKWh) {
    const blocks = Math.floor(input.batteryCapacityKWh / 10);
    base *= 1 + blocks * 0.04;                    // +4% mỗi 10kWh
  }
  const condFactor = { New: 1.15, LikeNew: 1.0, Used: 0.85, Worn: 0.7 } as const;
  if (input.condition) base *= condFactor[input.condition];

  const premium = ["tesla","bmw","mercedes"];
  if (input.make && premium.includes(input.make.toLowerCase())) base *= 1.08;

  const clamp = Math.max(baseFloor, base);
  const r100 = (n:number)=> Math.round(n/100)*100;

  const min = r100(clamp * 0.93);
  const max = r100(clamp * 1.07);
  const suggested = r100((min + max)/2);

  const filled = [input.year, input.mileageKm, input.batteryCapacityKWh, input.condition, input.make, input.model]
                 .filter(v => v !== undefined && v !== null).length;
  const confidence = filled >= 5 ? "high" : filled >= 3 ? "medium" : "low";

  return { suggested, range: { min, max }, currency: "USD", confidence, rationale_short: "Heuristic", factors: input };
}
