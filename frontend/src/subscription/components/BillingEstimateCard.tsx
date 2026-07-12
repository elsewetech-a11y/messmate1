import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";
import { PRICING_CONFIG } from "../constants/pricingConfig";

type BillingEstimateCardProps = {
  currentCapacity: number;
  requestedCapacity: number;
  planType: "monthly" | "yearly";
};

export function BillingEstimateCard({ currentCapacity, requestedCapacity, planType }: BillingEstimateCardProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const additionalStudents = requestedCapacity - currentCapacity;
  if (additionalStudents <= 0) return null;

  const pricePerStudent = planType === "monthly" ? PRICING_CONFIG.MONTHLY_PRICE : PRICING_CONFIG.YEARLY_PRICE;
  const additionalCost = planType === "monthly" 
    ? additionalStudents * pricePerStudent 
    : additionalStudents * pricePerStudent * 12;

  const newTotal = planType === "monthly" 
    ? requestedCapacity * PRICING_CONFIG.MONTHLY_PRICE 
    : requestedCapacity * PRICING_CONFIG.YEARLY_PRICE * 12;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Upgrade Estimate</Text>
      
      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Current Capacity</Text>
        <Text style={styles.value}>{currentCapacity}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Requested Capacity</Text>
        <Text style={styles.value}>{requestedCapacity}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Additional Students</Text>
        <Text style={[styles.value, { color: c.primary }]}>+{additionalStudents}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Price Per Student</Text>
        <Text style={styles.value}>₹{pricePerStudent.toFixed(2)}</Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.row}>
        <Text style={styles.labelBold}>Additional Cost Today</Text>
        <Text style={styles.valueBold}>₹{additionalCost.toLocaleString()}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.labelTotal}>New {planType === "monthly" ? "Monthly" : "Yearly"} Total (Upon Renewal)</Text>
        <Text style={styles.valueTotal}>₹{newTotal.toLocaleString()}</Text>
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
      borderColor: c.primary + "50",
      ...shadow.card,
      marginBottom: 16,
    },
    title: {
      ...typography.title2,
      color: c.textPrimary,
      marginBottom: 8,
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: 12,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    label: {
      ...typography.caption,
      color: c.textSecondary,
    },
    value: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: "500",
    },
    labelBold: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: "600",
    },
    valueBold: {
      ...typography.body,
      color: c.primary,
      fontWeight: "700",
    },
    labelTotal: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 8,
    },
    valueTotal: {
      ...typography.title2,
      color: c.textPrimary,
      marginTop: 8,
    },
  });
