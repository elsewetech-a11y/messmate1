import { useState, useCallback, useMemo } from "react";
import { PRICING_CONFIG, calculateMonthlyPrice, calculateYearlyPrice } from "../constants/pricingConfig";

export type BillingCycle = "monthly" | "yearly";

export function useSubscriptionCalculator(
  initialStudents: number = PRICING_CONFIG.MIN_STUDENTS,
  minStudents: number = PRICING_CONFIG.MIN_STUDENTS,
  isUpgrade: boolean = false,
  currentLimit: number = 0
) {
  // During an upgrade, the minimum is currentLimit + PRICING_CONFIG.MIN_STUDENTS
  const effectiveMin = isUpgrade ? currentLimit + PRICING_CONFIG.MIN_STUDENTS : minStudents;
  
  const [students, setStudents] = useState(Math.max(initialStudents, effectiveMin));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const handleStudentChange = useCallback((value: number) => {
    // Keep internal state updated even if it's outside limits (for manual typing),
    // but we will validate it before submission.
    setStudents(value);
  }, []);

  const handleSliderChange = useCallback((value: number) => {
    setStudents(Math.max(effectiveMin, Math.min(PRICING_CONFIG.MAX_STUDENTS, value)));
  }, [effectiveMin]);

  const handleInputBlur = useCallback(() => {
    if (students < effectiveMin) {
      setStudents(effectiveMin);
    } else if (students > PRICING_CONFIG.MAX_STUDENTS) {
      setStudents(PRICING_CONFIG.MAX_STUDENTS);
    }
  }, [students, effectiveMin]);

  const billedStudents = isUpgrade ? Math.max(0, students - currentLimit) : students;

  const totalPrice = billingCycle === "monthly" 
    ? calculateMonthlyPrice(billedStudents) 
    : calculateYearlyPrice(billedStudents);

  const isValid = students >= effectiveMin && students <= PRICING_CONFIG.MAX_STUDENTS;

  const pricePerStudent = billingCycle === "monthly"
    ? PRICING_CONFIG.MONTHLY_PRICE
    : PRICING_CONFIG.YEARLY_PRICE;

  const subscriptionDuration = billingCycle === "monthly" ? 30 : 365;

  const subscriptionLabel = billingCycle === "monthly" ? "Monthly" : "Yearly";

  return {
    students,
    billingCycle,
    setBillingCycle,
    handleStudentChange,
    handleSliderChange,
    handleInputBlur,
    totalPrice,
    isValid,
    pricePerStudent,
    subscriptionDuration,
    subscriptionLabel,
    effectiveMin
  };
}
