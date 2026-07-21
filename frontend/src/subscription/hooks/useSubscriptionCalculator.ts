import { useState, useCallback } from "react";
import { PRICING_CONFIG, calculateMonthlyPrice, calculateYearlyPrice } from "../constants/pricingConfig";

export type BillingCycle = "monthly" | "yearly";

export function useSubscriptionCalculator(
  initialStudents: number = PRICING_CONFIG.MIN_STUDENTS,
  minStudents: number = PRICING_CONFIG.MIN_STUDENTS
) {
  const [students, setStudents] = useState(Math.max(initialStudents, minStudents));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const handleStudentChange = useCallback((value: number) => {
    // Keep internal state updated even if it's outside limits (for manual typing),
    // but we will validate it before submission.
    setStudents(value);
  }, []);

  const handleSliderChange = useCallback((value: number) => {
    setStudents(Math.max(minStudents, Math.min(PRICING_CONFIG.MAX_STUDENTS, value)));
  }, [minStudents]);

  const handleInputBlur = useCallback(() => {
    if (students < minStudents) {
      setStudents(minStudents);
    } else if (students > PRICING_CONFIG.MAX_STUDENTS) {
      setStudents(PRICING_CONFIG.MAX_STUDENTS);
    }
  }, [students, minStudents]);

  const totalPrice = billingCycle === "monthly" 
    ? calculateMonthlyPrice(students) 
    : calculateYearlyPrice(students);

  const isValid = students >= minStudents && students <= PRICING_CONFIG.MAX_STUDENTS;

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
  };
}
