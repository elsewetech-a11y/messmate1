import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { typography, useTheme, type ThemeColors } from "@/src/theme";
import { useSubscription } from "../hooks/useSubscription";

export function SubscriptionBanner() {
  const { c } = useTheme();
  const router = useRouter();
  const { subscription: status, loading: isLoading } = useSubscription();

  if (isLoading || !status) return null;

  const days = status.days_remaining;
  
  // Hide the banner completely for new trial users (let email reminders do the job)
  if (status.is_trial && days > 3) {
    return null;
  }

  // Don't show banner to non-admin roles
  const planName = status.is_trial ? "Free Trial" : "Premium"; // Ideally plan_type is passed

  let bgColor = c.success;
  let label = "Subscription Active";

  if (days < 0 || status.status === "SUBSCRIPTION_EXPIRED" || status.status === "TRIAL_EXPIRED") {
    bgColor = c.danger;
    label = "Subscription Expired - Renew Immediately";
  } else if (days < 7) {
    bgColor = c.warning; // Orange equivalent if possible, using warning for now
    label = "Renew Now";
  } else if (days <= 30) {
    bgColor = "#EAB308"; // Yellow
    label = "Subscription Expiring Soon";
  } else {
    bgColor = c.success;
    label = "Subscription Active";
  }

  return (
    <View style={[styles.banner, { backgroundColor: bgColor }]}>
      <View style={styles.content}>
        <View style={styles.infoGroup}>
          <Text style={styles.textBold}>{planName}</Text>
          <Text style={styles.textSeparator}>•</Text>
          <Text style={styles.text}>{status.student_limit} Students</Text>
          <Text style={styles.textSeparator}>•</Text>
          <Text style={styles.textBold}>
            {days > 0 ? `${days} Days Remaining` : "Expired"}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.renewBtn} 
          onPress={() => router.push("/(admin)/subscription" as any)}
        >
          <Text style={[styles.renewText, { color: bgColor }]}>Renew</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 50,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    flexWrap: "wrap",
    gap: 6,
  },
  text: {
    ...typography.caption,
    color: "#FFFFFF",
  },
  textBold: {
    ...typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  textSeparator: {
    ...typography.caption,
    color: "rgba(255,255,255,0.5)",
  },
  renewBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  renewText: {
    ...typography.caption,
    fontWeight: "800",
  },
});
