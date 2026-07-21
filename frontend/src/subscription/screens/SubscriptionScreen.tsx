import React, { useState, useMemo, useEffect } from "react";
import { StyleSheet, ScrollView, View, Text, SafeAreaView, ActivityIndicator } from "react-native";
import { PRICING_CONFIG } from "../constants/pricingConfig";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, shadow, spacing, typography, type ThemeColors } from "@/src/theme";
import { useSubscriptionCalculator } from "../hooks/useSubscriptionCalculator";
import { useSubscription } from "../hooks/useSubscription";
import { useAuth } from "@/src/auth/AuthContext";
import { paymentService } from "../payment/services/paymentService";
import { formatISOasDateIST } from "@/src/utils/istDate";
import { Button } from "@/src/components/Button";

import { PlanSelector } from "../components/PlanSelector";
import { StudentSlider } from "../components/StudentSlider";
import { PriceSummary } from "../components/PriceSummary";
import { SupportCard } from "../components/SupportCard";

export function SubscriptionScreen() {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { token, user } = useAuth();

  const { subscription, loading: subLoading, refreshStatus } = useSubscription();

  const dynamicMinStudents = useMemo(() => {
    return Math.max(PRICING_CONFIG.MIN_STUDENTS, subscription?.registered_students || 0);
  }, [subscription?.registered_students]);

  const {
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
  } = useSubscriptionCalculator(500, dynamicMinStudents);

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (subscription && !initialized) {
      const initialCount = Math.max(subscription.registered_students, PRICING_CONFIG.MIN_STUDENTS);
      handleStudentChange(initialCount);
      setInitialized(true);
    }
  }, [subscription, initialized, handleStudentChange]);

  // Current status derived info
  const currentStatus = subscription?.status;
  const isActive = currentStatus === "ACTIVE" || currentStatus === "TRIAL_ACTIVE";
  const isExpired = currentStatus === "SUBSCRIPTION_EXPIRED" || currentStatus === "TRIAL_EXPIRED";
  const isTrial = subscription?.is_trial;

  const handlePayNow = async () => {
    if (!token || !user || !isValid) return;

    let currentOrderId: string | null = null;

    try {
      setPaymentLoading(true);
      setPaymentError(null);

      // 1. Create Order
      const order = await paymentService.createOrder(token, {
        plan_type: billingCycle,
        student_count: students,
      });
      currentOrderId = order.order_id;

      // 2. Process Payment via Provider
      const { paymentId, signature } = await paymentService.processPayment(
        order,
        user.email,
        user.institution_or_hostel_name
      );

      // 3. Verify Payment with backend
      await paymentService.verifyPayment(token, {
        order_id: order.order_id,
        payment_id: paymentId,
        signature,
      });

      // 4. Success!
      setPaymentSuccess(true);
      await refreshStatus();
    } catch (err: any) {
      console.error("[SubscriptionScreen] Payment flow error:", err);
      const errMsg = err.message || "Payment failed. Please try again.";
      if (currentOrderId) {
        paymentService
          .reportPaymentFailed(token, currentOrderId, errMsg)
          .catch(console.error);
      }
      setPaymentError(errMsg);
    } finally {
      setPaymentLoading(false);
    }
  };

  // ─── Payment Success State ────────────────────────────────
  if (paymentSuccess) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <Feather name="check" size={48} color={c.success} />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>
            Your {subscriptionLabel} subscription is now active for{" "}
            {subscriptionDuration} days. You have full access to all application
            features.
          </Text>

          <View style={styles.successDetailsCard}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Plan</Text>
              <Text style={styles.successValue}>{subscriptionLabel}</Text>
            </View>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Students</Text>
              <Text style={styles.successValue}>{students.toLocaleString()}</Text>
            </View>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Amount Paid</Text>
              <Text style={styles.successValue}>₹{totalPrice.toLocaleString()}</Text>
            </View>
          </View>

          <Button
            testID="go-dashboard-btn"
            label="Go to Dashboard"
            onPress={() => router.replace("/(admin)/dashboard")}
            style={{ marginTop: 24, minWidth: 200 }}
          />
          <Button
            testID="view-billing-btn"
            label="View Billing History"
            variant="secondary"
            onPress={() => router.push("/(admin)/billing" as any)}
            style={{ marginTop: 12, minWidth: 200 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Loading State ────────────────────────────────────────
  if (subLoading && !subscription) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={styles.loadingText}>Loading subscription details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main Manage Plan Screen ──────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ─────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SUBSCRIPTION</Text>
          <Text style={styles.title}>Manage Plan</Text>
          <Text style={styles.subtitle}>
            Subscriptions are calculated based on the number of students connected
            to your institution. Choose a Monthly or Yearly plan below.
          </Text>
        </View>

        {/* ─── Current Status Badge ───────────── */}
        {subscription && (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Feather
                  name={isActive ? "check-circle" : isExpired ? "x-circle" : "clock"}
                  size={20}
                  color={isActive ? c.success : isExpired ? c.danger : c.warning}
                />
                <View>
                  <Text style={styles.statusLabel}>
                    {isTrial ? "Free Trial" : subscription.plan_type === "yearly" ? "Yearly Plan" : "Monthly Plan"}
                  </Text>
                  <Text style={[
                    styles.statusValue,
                    { color: isActive ? c.success : isExpired ? c.danger : c.warning }
                  ]}>
                    {isActive
                      ? `Active · ${subscription.days_remaining} days remaining`
                      : isExpired
                      ? "Expired — Renew to continue"
                      : "Pending"}
                  </Text>
                </View>
              </View>
              <View style={styles.studentsBadge}>
                <Feather name="users" size={14} color={c.primary} />
                <Text style={styles.studentsBadgeText}>
                  {subscription.registered_students}/{subscription.student_limit}
                </Text>
              </View>
            </View>

            {subscription.expiry_date && (
              <View style={styles.expiryInfo}>
                <Feather name="calendar" size={12} color={c.textTertiary} />
                <Text style={styles.expiryInfoText}>
                  {isExpired ? "Expired" : "Expires"}: {formatISOasDateIST(subscription.expiry_date)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ─── Plan Selector ─────────────────── */}
        <PlanSelector
          selectedPlan={billingCycle}
          onSelectPlan={setBillingCycle}
        />

        {/* ─── Student Slider + Input ────────── */}
        <StudentSlider
          students={students}
          minStudents={dynamicMinStudents}
          onSliderChange={handleSliderChange}
          onInputChange={handleStudentChange}
          onInputBlur={handleInputBlur}
          billingCycle={billingCycle}
        />

        {/* ─── Subscription Summary ──────────── */}
        <PriceSummary
          plan={billingCycle}
          students={students}
          totalPrice={totalPrice}
          isValid={isValid}
          pricePerStudent={pricePerStudent}
          subscriptionDuration={subscriptionDuration}
        />

        {/* ─── Payment Error ─────────────────── */}
        {paymentError && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={c.danger} />
            <Text style={styles.errorText}>{paymentError}</Text>
          </View>
        )}

        {/* ─── Pay Now Button ────────────────── */}
        <View style={styles.payButtonContainer}>
          <Button
            testID="pay-now-btn"
            label={
              paymentLoading
                ? "Processing Payment…"
                : `Pay ₹${isValid ? totalPrice.toLocaleString() : "—"} Now`
            }
            onPress={handlePayNow}
            disabled={!isValid || paymentLoading}
            style={StyleSheet.flatten([
              styles.payButton,
              (!isValid || paymentLoading) && styles.payButtonDisabled,
            ])}
          />

          {paymentLoading && (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={c.primary} />
              <Text style={styles.processingText}>
                Please wait while your payment is being processed…
              </Text>
            </View>
          )}

          <View style={styles.secureRow}>
            <Feather name="lock" size={12} color={c.textTertiary} />
            <Text style={styles.secureText}>Secure Payment Processing</Text>
          </View>
        </View>

        {/* ─── Contact Support ───────────────── */}
        <SupportCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: c.bg,
    },
    container: {
      padding: spacing.lg,
      paddingBottom: 80,
    },

    // ─── Header ───────────────
    header: {
      marginBottom: spacing.lg,
    },
    eyebrow: {
      ...typography.caption,
      color: c.primary,
      letterSpacing: 1.5,
      fontWeight: "700",
      marginBottom: 6,
    },
    title: {
      ...typography.title1,
      color: c.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      lineHeight: 24,
    },

    // ─── Current Status ───────
    statusCard: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      ...shadow.card,
      marginBottom: spacing.lg,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    statusLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    statusLabel: {
      ...typography.headline,
      color: c.textPrimary,
    },
    statusValue: {
      ...typography.caption,
      fontWeight: "500",
      marginTop: 2,
    },
    studentsBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    studentsBadgeText: {
      ...typography.caption,
      fontWeight: "600",
      color: c.primaryDark,
    },
    expiryInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    expiryInfoText: {
      ...typography.caption,
      color: c.textTertiary,
    },

    // ─── Payment Error ────────
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.dangerTint,
      padding: 12,
      borderRadius: radius.md,
      marginBottom: 16,
      gap: 8,
    },
    errorText: {
      ...typography.subhead,
      color: c.danger,
      flex: 1,
    },

    // ─── Pay Button ───────────
    payButtonContainer: {
      marginBottom: spacing.lg,
    },
    payButton: {
      backgroundColor: c.primary,
    },
    payButtonDisabled: {
      backgroundColor: c.border,
      opacity: 0.7,
    },
    processingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 12,
    },
    processingText: {
      ...typography.caption,
      color: c.textSecondary,
    },
    secureRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 12,
    },
    secureText: {
      ...typography.caption,
      color: c.textTertiary,
    },

    // ─── Success State ────────
    successContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    successCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.success + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 32,
    },
    successTitle: {
      ...typography.title1,
      color: c.textPrimary,
      textAlign: "center",
      marginBottom: 16,
    },
    successSubtitle: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
    successDetailsCard: {
      width: "100%",
      backgroundColor: c.card,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: 24,
    },
    successRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
    },
    successLabel: {
      ...typography.body,
      color: c.textSecondary,
    },
    successValue: {
      ...typography.body,
      fontWeight: "600",
      color: c.textPrimary,
    },

    // ─── Loading State ────────
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 16,
    },
    loadingText: {
      ...typography.body,
      color: c.textSecondary,
    },
  });
