export interface IRenewRequest {
  months: number;
}

export interface IRenewPricing {
  months: number;
  days: number;
  basePrice: number;
  discount: number; // %
  finalPrice: number;
}
