export const PRICING_CONFIG = {
  MONTHLY_PRICE: 3.0,
  YEARLY_PRICE: 2.50,
  MIN_STUDENTS: 250,
  MAX_STUDENTS: 10000,
  FREE_TRIAL_DAYS: 10,
  FUTURE_GST_PERCENTAGE: 0,
  FUTURE_DISCOUNT_PERCENTAGE: 0,
};

export const calculateMonthlyPrice = (students: number) => {
  return students * PRICING_CONFIG.MONTHLY_PRICE;
};

export const calculateYearlyPrice = (students: number) => {
  return students * PRICING_CONFIG.YEARLY_PRICE * 12; // Yearly total
};

export const calculateYearlyPricePerMonth = (students: number) => {
  return students * PRICING_CONFIG.YEARLY_PRICE;
};
