import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";
import type { BillingCycle } from "../hooks/useSubscriptionCalculator";
import { PRICING_CONFIG } from "../constants/pricingConfig";
import { todayInIST, formatDateIST } from "@/src/utils/istDate";

type PriceSummaryProps = {
  plan: BillingCycle;
  students: number;
  totalPrice: number;
  isValid: boolean;
  pricePerStudent: number;
  subscriptionDuration: number;
};

export function PriceSummary({
  plan,
  students,
  totalPrice,
  isValid,
  pricePerStudent,
  subscriptionDuration,
}: PriceSummaryProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Calculate the expected expiry date
  const expectedExpiry = useMemo(() => {
    const start = todayInIST();
    const expiry = new Date(start.getTime() + subscriptionDuration * 24 * 60 * 60 * 1000);
    return formatDateIST(expiry);
  }, [subscriptionDuration]);

  if (!isValid) {
    return (
      <View style={[styles.card, styles.cardDisabled]}>
        <View style={styles.invalidRow}>
          <Feather name="alert-circle" size={20} color={c.textTertiary} />
          <Text style={styles.invalidText}>
            Select a valid number of students ({PRICING_CONFIG.MIN_STUDENTS}–{PRICING_CONFIG.MAX_STUDENTS.toLocaleString()}) to see the subscription summary.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Subscription Summary</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Selected Plan</Text>
        <Text style={styles.value}>{plan === "monthly" ? "Monthly" : "Yearly"}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Total Students</Text>
        <Text style={styles.value}>{students.toLocaleString()}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Price Per Student</Text>
        <Text style={styles.value}>₹{plan === "monthly" ? pricePerStudent : pricePerStudent.toFixed(2)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Subscription Duration</Text>
        <Text style={styles.value}>{subscriptionDuration} Days</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalValue}>
          ₹{totalPrice.toLocaleString()}
        </Text>
      </View>

      <View style={styles.expiryRow}>
        <Feather name="calendar" size={14} color={c.textSecondary} />
        <Text style={styles.expiryText}>
          Expected Expiry: {expectedExpiry}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.primaryLight,
      borderRadius: radius.lg,
      padding: 20,
      borderWidth: 1,
      borderColor: c.primaryTint,
      ...shadow.card,
      marginBottom: 16,
    },
    cardDisabled: {
      backgroundColor: c.bg2,
      borderColor: c.border,
    },
    invalidRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    invalidText: {
      ...typography.body,
      color: c.textTertiary,
      flex: 1,
      lineHeight: 22,
    },
    title: {
      ...typography.title2,
      color: c.primaryDark,
      marginBottom: 16,
      textAlign: "center",
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    label: {
      ...typography.body,
      color: c.textSecondary,
    },
    value: {
      ...typography.body,
      fontWeight: "600",
      color: c.textPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: 12,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
      marginBottom: 12,
    },
    totalLabel: {
      ...typography.title2,
      color: c.textPrimary,
    },
    totalValue: {
      fontSize: 28,
      fontWeight: "700",
      color: c.primaryDark,
    },
    totalPeriod: {
      fontSize: 14,
      fontWeight: "500",
      color: c.textSecondary,
    },
    expiryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
      backgroundColor: c.card,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: radius.md,
    },
    expiryText: {
      ...typography.caption,
      color: c.textSecondary,
      fontWeight: "500",
    },
  });
