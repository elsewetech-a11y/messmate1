import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";

type CapacitySectionProps = {
  purchasedLimit: number;
  currentStudents: number;
};

export function CapacitySection({ purchasedLimit, currentStudents }: CapacitySectionProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const availableSeats = purchasedLimit - currentStudents;
  const isExceeded = currentStudents > purchasedLimit;

  const percentage = purchasedLimit > 0 ? (currentStudents / purchasedLimit) * 100 : 0;
  const clampedPercentage = Math.min(percentage, 100);
  
  let progressColor = c.success;
  if (percentage >= 100) progressColor = c.danger;
  else if (percentage >= 90) progressColor = c.warning; // Orange equivalent
  else if (percentage > 70) progressColor = "#EAB308"; // Yellow

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Student Capacity</Text>
      
      <Text style={styles.ratioText}>{currentStudents} / {purchasedLimit} Students</Text>
      
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${clampedPercentage}%`, backgroundColor: progressColor }]} />
      </View>
      <Text style={styles.percentageText}>{percentage.toFixed(1)}%</Text>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Available Seats</Text>
          <Text style={[styles.statValue, { color: isExceeded ? c.danger : c.success }]}>
            {Math.max(0, availableSeats)}
          </Text>
        </View>
      </View>

      {percentage >= 90 && (
        <View style={[styles.warningBox, { backgroundColor: percentage >= 100 ? c.danger + "20" : c.warning + "20" }]}>
          <Feather name="alert-triangle" size={20} color={percentage >= 100 ? c.danger : c.warning} />
          <View style={styles.warningTextContainer}>
            <Text style={[styles.warningTitle, { color: percentage >= 100 ? c.danger : c.warning }]}>
              Warning
            </Text>
            <Text style={styles.warningSubtitle}>
              Your institution is nearing its purchased student capacity. Upgrade now to continue approving new students.
            </Text>
          </View>
        </View>
      )}
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
    title: {
      ...typography.title2,
      color: c.textPrimary,
      marginBottom: 16,
    },
    ratioText: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: "600",
      marginBottom: 8,
    },
    progressBarContainer: {
      height: 12,
      backgroundColor: c.border,
      borderRadius: 6,
      overflow: "hidden",
      marginBottom: 4,
    },
    progressBarFill: {
      height: "100%",
      borderRadius: 6,
    },
    percentageText: {
      ...typography.caption,
      color: c.textSecondary,
      textAlign: "right",
      marginBottom: 16,
    },
    statsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    statItem: {
      alignItems: "flex-start",
    },
    statLabel: {
      ...typography.caption,
      color: c.textSecondary,
    },
    statValue: {
      ...typography.title2,
      color: c.textPrimary,
    },
    warningBox: {
      flexDirection: "row",
      backgroundColor: c.danger + "10",
      padding: 12,
      borderRadius: radius.md,
      alignItems: "flex-start",
      gap: 12,
    },
    warningTextContainer: {
      flex: 1,
    },
    warningTitle: {
      ...typography.body,
      color: c.danger,
      fontWeight: "700",
    },
    warningSubtitle: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 2,
    },
  });
