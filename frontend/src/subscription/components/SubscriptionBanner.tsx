import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { typography, useTheme } from "@/src/theme";
import { useSubscription } from "../hooks/useSubscription";
import { formatISOasDateIST } from "@/src/utils/istDate";

export function SubscriptionBanner() {
  const { c } = useTheme();
  const router = useRouter();
  const { subscription: status, loading: isLoading } = useSubscription();

  if (isLoading || !status) return null;

  const days = status.days_remaining;
  const isTrial = status.is_trial;

  let bgColor = c.success;
  let content = null;

  if (isTrial) {
    if (days < 0 || status.status === "TRIAL_EXPIRED") {
      bgColor = c.danger;
      content = (
        <View style={styles.infoGroup}>
          <Text style={styles.textBold}>Free Trial Expired.</Text>
        </View>
      );
    } else {
      let daysText = "";
      if (days === 0) {
        bgColor = c.danger;
        daysText = "Today is the last day of the free trial.";
      } else if (days <= 2) {
        bgColor = c.warning;
        daysText = "Trial is about to expire.";
      } else if (days <= 5) {
        bgColor = "#EAB308"; // Stronger reminder color
        daysText = `${days} Days Left`;
      } else {
        bgColor = c.success;
        daysText = `${days} Days Left`;
      }

      const endDateStr = status.expiry_date 
        ? formatISOasDateIST(status.expiry_date)
        : "";

      content = (
        <View style={styles.infoGroup}>
          <Text style={styles.textBold}>Free Trial Active</Text>
          <Text style={styles.textSeparator}>•</Text>
          <Text style={styles.textBold}>{daysText}</Text>
          {endDateStr ? (
            <>
              <Text style={styles.textSeparator}>•</Text>
              <Text style={styles.text}>Ends {endDateStr}</Text>
            </>
          ) : null}
        </View>
      );
    }
  } else {
    // Paid subscription
    if (days < 0 || status.status === "SUBSCRIPTION_EXPIRED") {
      bgColor = c.danger;
      content = (
        <View style={styles.infoGroup}>
          <Text style={styles.textBold}>Subscription Expired</Text>
        </View>
      );
    } else {
      bgColor = c.success;
      const endDateStr = status.expiry_date 
        ? formatISOasDateIST(status.expiry_date)
        : "";
      content = (
        <View style={styles.infoGroup}>
          <Text style={styles.textBold}>Current Plan: {status.plan_type?.toUpperCase() || "PREMIUM"}</Text>
          <Text style={styles.textSeparator}>•</Text>
          <Text style={styles.text}>{days} Days Remaining</Text>
          {endDateStr ? (
            <>
              <Text style={styles.textSeparator}>•</Text>
              <Text style={styles.text}>Ends {endDateStr}</Text>
            </>
          ) : null}
          <Text style={styles.textSeparator}>•</Text>
          <Text style={styles.text}>Status: Active</Text>
        </View>
      );
    }
  }

  return (
    <View style={[styles.banner, { backgroundColor: bgColor }]}>
      <View style={styles.content}>
        {content}
        <TouchableOpacity 
          style={styles.renewBtn} 
          onPress={() => router.push("/(admin)/subscription" as any)}
        >
          <Text style={[styles.renewText, { color: bgColor }]}>
            {(days < 0 || status.status.includes("EXPIRED")) ? "Subscribe Now" : "Manage Plan"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    paddingVertical: 10,
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
    paddingVertical: 6,
    borderRadius: 12,
  },
  renewText: {
    ...typography.caption,
    fontWeight: "700",
  }
});
