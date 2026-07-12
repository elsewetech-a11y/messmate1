import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, typography, useTheme, type ThemeColors } from "@/src/theme";
import type { OrderCreateRequest } from "@/src/api/client";

type PaymentSummaryProps = {
  institutionName: string;
  plan: OrderCreateRequest;
  amount: number;
};

export function PaymentSummary({ institutionName, plan, amount }: PaymentSummaryProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const pricePerStudent = plan.plan_type === "monthly" ? "₹2/student/month" : "₹1.50/student/month";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Payment Summary</Text>
      
      <View style={styles.row}>
        <Text style={styles.label}>Institution:</Text>
        <Text style={styles.value}>{institutionName}</Text>
      </View>
      <View style={styles.divider} />
      
      <View style={styles.row}>
        <Text style={styles.label}>Plan:</Text>
        <Text style={[styles.value, { textTransform: "capitalize", ...typography.body, fontWeight: "600", color: c.primary }]}>
          {plan.plan_type}
        </Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Students:</Text>
        <Text style={styles.value}>{plan.student_count}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Rate:</Text>
        <Text style={styles.value}>{pricePerStudent}</Text>
      </View>
      <View style={styles.divider} />
      
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={styles.totalValue}>₹{amount.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bg2,
      borderRadius: radius.md,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 24,
    },
    title: {
      ...typography.subhead,
      color: c.textPrimary,
      fontWeight: "700",
      marginBottom: 16,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    label: {
      ...typography.body,
      color: c.textSecondary,
    },
    value: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: "600",
      textAlign: "right",
      flex: 1,
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: 12,
    },
    totalLabel: {
      ...typography.title2,
      color: c.textPrimary,
    },
    totalValue: {
      ...typography.title2,
      color: c.primary,
      fontWeight: "700",
    },
  });
