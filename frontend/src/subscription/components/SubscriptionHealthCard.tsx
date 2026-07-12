import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";
import { Feather } from "@expo/vector-icons";

type SubscriptionHealthCardProps = {
  daysRemaining: number;
  currentPlan: string;
  studentUsagePercent: number;
};

export function SubscriptionHealthCard({ daysRemaining, currentPlan, studentUsagePercent }: SubscriptionHealthCardProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  let healthColor = c.success;
  let healthText = "🟢 Healthy";
  let riskText = "Low";

  if (daysRemaining <= 0) {
    healthColor = c.danger;
    healthText = "🔴 Expired";
    riskText = "Critical";
  } else if (daysRemaining < 7) {
    healthColor = c.warning; // Orange equivalent
    healthText = "🟠 At Risk";
    riskText = "High";
  } else if (daysRemaining <= 30) {
    healthColor = "#EAB308"; // Yellow
    healthText = "🟡 Fair";
    riskText = "Medium";
  }

  // If usage is very high, increase risk factor
  if (studentUsagePercent >= 90 && daysRemaining > 0) {
    riskText = "High (Capacity)";
    healthColor = c.warning;
    healthText = "🟠 Action Needed";
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Subscription Health</Text>
        <Text style={[styles.healthBadge, { color: healthColor }]}>{healthText}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Current Plan</Text>
        <Text style={styles.value}>{currentPlan}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Days Remaining</Text>
        <Text style={[styles.value, { color: daysRemaining <= 0 ? c.danger : c.textPrimary }]}>
          {daysRemaining}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Student Usage</Text>
        <Text style={styles.value}>{studentUsagePercent.toFixed(1)}%</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Renewal Risk</Text>
        <Text style={[styles.value, { color: healthColor }]}>{riskText}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      ...shadow.card,
      marginBottom: 16,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    title: {
      ...typography.title2,
      color: c.textPrimary,
    },
    healthBadge: {
      ...typography.body,
      fontWeight: "700",
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
    },
    label: {
      ...typography.caption,
      color: c.textSecondary,
    },
    value: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: "600",
    },
  });
