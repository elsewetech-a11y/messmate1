import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";
import { useSubscription } from "../hooks/useSubscription";
import { formatISOasDateIST } from "@/src/utils/istDate";

export function SubscriptionWidget() {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { subscription, loading } = useSubscription();

  if (loading || !subscription) return null;

  const { status, days_remaining, student_limit, registered_students, plan_type, is_trial, expiry_date } = subscription;
  const isExpired = days_remaining <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Subscription Summary</Text>
        <View style={[styles.badge, { backgroundColor: isExpired ? c.danger + "20" : c.success + "20" }]}>
          <Text style={[styles.badgeText, { color: isExpired ? c.danger : c.success }]}>
            {status}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.label}>Current Plan</Text>
          <Text style={styles.value}>{is_trial ? "Free Trial" : (plan_type === "yearly" ? "Yearly" : "Monthly")}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>Student Capacity</Text>
          <Text style={styles.value}>{registered_students} / {student_limit}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>Days Remaining</Text>
          <Text style={[styles.value, isExpired && { color: c.danger }]}>{days_remaining}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>Next Renewal</Text>
          <Text style={styles.value}>{expiry_date ? formatISOasDateIST(expiry_date) : "N/A"}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push("/(admin)/subscription" as any)}
      >
        <Text style={styles.buttonText}>Renew Now</Text>
      </TouchableOpacity>
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
      marginBottom: 16,
    },
    title: {
      ...typography.title2,
      color: c.textPrimary,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    badgeText: {
      ...typography.caption,
      fontWeight: "700",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
      marginBottom: 16,
    },
    gridItem: {
      width: "45%",
    },
    label: {
      ...typography.caption,
      color: c.textSecondary,
      marginBottom: 4,
    },
    value: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: "600",
    },
    button: {
      backgroundColor: c.primary,
      paddingVertical: 12,
      borderRadius: radius.md,
      alignItems: "center",
    },
    buttonText: {
      ...typography.body,
      fontWeight: "600",
      color: "#FFFFFF",
    },
  });
