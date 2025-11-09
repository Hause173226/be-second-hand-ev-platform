interface RenewPricing {
  months: number;
  days: number;
  basePrice: number;
  discount: number; // %
  finalPrice: number;
}

/**
 * Tính giá gia hạn theo số tháng với discount
 */
export const calculateRenewPricing = (
  monthlyPrice: number,
  months: number
): RenewPricing => {
  const days = months * 30;
  const basePrice = monthlyPrice * months;

  let discount = 0;
  if (months === 3) {
    discount = 5; // Giảm 5%
  } else if (months === 6) {
    discount = 10; // Giảm 10%
  } else if (months === 12) {
    discount = 20; // Giảm 20%
  }

  const finalPrice = Math.round(basePrice * (1 - discount / 100));

  return {
    months,
    days,
    basePrice,
    discount,
    finalPrice,
  };
};
