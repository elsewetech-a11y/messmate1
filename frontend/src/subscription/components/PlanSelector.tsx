import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity, LayoutAnimation, Platform, UIManager } from "react-native";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";
import type { BillingCycle } from "../hooks/useSubscriptionCalculator";
import { PRICING_CONFIG } from "../constants/pricingConfig";
import { Feather } from "@expo/vector-icons";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PlanSelectorProps = {
  selectedPlan: BillingCycle;
  onSelectPlan: (plan: BillingCycle) => void;
  disabled?: boolean;
};

export function PlanSelector({ selectedPlan, onSelectPlan, disabled = false }: PlanSelectorProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const handleSelect = (plan: BillingCycle) => {
    if (disabled) return;
    if (plan !== selectedPlan) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
      );
      onSelectPlan(plan);
    }
  };

  return (
    <View style={[styles.container, disabled && { opacity: 0.6 }]}>
      <Text style={styles.sectionTitle}>Select Plan</Text>
      <Text style={styles.sectionSubtitle}>
        {disabled 
          ? "You must maintain your current plan type during an upgrade."
          : "Choose between monthly or yearly billing."}
      </Text>
      <View style={styles.row}>
        {/* Monthly Plan */}
        <TouchableOpacity
          testID="plan-monthly-btn"
          style={[
            styles.card,
            selectedPlan === "monthly" && styles.cardActive
          ]}
          onPress={() => handleSelect("monthly")}
          activeOpacity={disabled ? 1 : 0.8}
        >
          {selectedPlan === "monthly" && (
            <View style={styles.checkIcon}>
              <Feather name="check-circle" size={20} color={c.primary} />
            </View>
          )}
          <Text style={styles.planTitle}>Monthly Plan</Text>
          <Text style={styles.priceText}>₹{PRICING_CONFIG.MONTHLY_PRICE}</Text>
          <Text style={styles.perStudentText}>per student</Text>
          <Text style={styles.durationText}>30 Days</Text>
        </TouchableOpacity>

        {/* Yearly Plan */}
        <TouchableOpacity
          testID="plan-yearly-btn"
          style={[
            styles.card,
            selectedPlan === "yearly" && styles.cardActive
          ]}
          onPress={() => handleSelect("yearly")}
          activeOpacity={disabled ? 1 : 0.8}
        >
          {selectedPlan === "yearly" && (
            <View style={styles.checkIcon}>
              <Feather name="check-circle" size={20} color={c.primary} />
            </View>
          )}
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>Save ~16%</Text>
          </View>
          <Text style={styles.planTitle}>Yearly Plan</Text>
          <Text style={styles.priceText}>₹{PRICING_CONFIG.YEARLY_PRICE.toFixed(2)}</Text>
          <Text style={styles.perStudentText}>per student</Text>
          <Text style={styles.durationText}>365 Days</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    sectionTitle: {
      ...typography.title2,
      color: c.textPrimary,
      marginBottom: 4,
    },
    sectionSubtitle: {
      ...typography.body,
      color: c.textSecondary,
      marginBottom: 14,
      lineHeight: 22,
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    card: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: 16,
      borderWidth: 2,
      borderColor: c.border,
      ...shadow.card,
      position: "relative",
    },
    cardActive: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    checkIcon: {
      position: "absolute",
      top: 12,
      right: 12,
    },
    planTitle: {
      ...typography.body,
      fontWeight: "600",
      color: c.textPrimary,
      marginBottom: 8,
    },
    priceText: {
      ...typography.title1,
      fontSize: 28,
      color: c.textPrimary,
      marginBottom: 4,
    },
    perStudentText: {
      ...typography.caption,
      color: c.textSecondary,
    },
    durationText: {
      ...typography.caption,
      color: c.primary,
      fontWeight: "600",
      marginTop: 8,
    },
    saveBadge: {
      position: "absolute",
      top: -10,
      right: 10,
      backgroundColor: c.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    saveBadgeText: {
      ...typography.caption,
      color: c.textInverse,
      fontWeight: "700",
    },
  });
