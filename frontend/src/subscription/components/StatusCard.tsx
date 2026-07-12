import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";
import { Button } from "@/src/components/Button";

type Status = "FREE_TRIAL" | "ACTIVE" | "EXPIRED" | "PAYMENT_PENDING";

type StatusCardProps = {
  status: Status;
  remainingDays?: number;
  expiryDate?: string;
  planName?: string;
};

export function StatusCard({ status, remainingDays, expiryDate, planName = "Free Trial" }: StatusCardProps) {
  const { c } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(c), [c]);

  let statusColor = c.warning;
  let statusText = "Free Trial";
  let iconName: keyof typeof Feather.glyphMap = "clock";

  switch (status) {
    case "ACTIVE":
      statusColor = c.success;
      statusText = "Active";
      iconName = "check-circle";
      break;
    case "EXPIRED":
      statusColor = c.danger;
      statusText = "Expired";
      iconName = "x-circle";
      break;
    case "PAYMENT_PENDING":
      statusColor = c.pending;
      statusText = "Payment Pending";
      iconName = "alert-circle";
      break;
    case "FREE_TRIAL":
    default:
      statusColor = c.warning;
      statusText = "Free Trial";
      iconName = "clock";
      break;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Subscription Status</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.statusBadge}>
          <Feather name={iconName} size={24} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>{planName}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.label}>
            {status === "FREE_TRIAL" ? "Remaining Days" : "Expires"}
          </Text>
          <Text style={styles.value}>
            {status === "FREE_TRIAL" ? `${remainingDays} Days` : expiryDate}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Button 
          label="View Billing History" 
          onPress={() => router.push("/(admin)/billing" as any)}
        />
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
      marginBottom: 16,
    },
    title: {
      ...typography.title2,
      color: c.textPrimary,
    },
    content: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusText: {
      ...typography.title1,
      fontSize: 22,
    },
    details: {
      alignItems: "flex-end",
    },
    label: {
      ...typography.caption,
      color: c.textSecondary,
    },
    value: {
      ...typography.body,
      fontWeight: "600",
      color: c.textPrimary,
    },
    footer: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 16,
    },
  });
