import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";
import { useRouter } from "expo-router";

type PlanRecommendationProps = {
  currentPlan: string;
};

export function PlanRecommendation({ currentPlan }: PlanRecommendationProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  // If already on Yearly, don't show recommendation
  if (currentPlan === "yearly") {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="trending-up" size={20} color={c.primary} />
        <Text style={styles.title}>Recommendation</Text>
      </View>
      
      <Text style={styles.subtitle}>
        You have renewed your Monthly Plan several times. Switching to a Yearly Plan could reduce your annual subscription cost by up to 25%.
      </Text>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push("/(admin)/subscription?plan_type=yearly" as any)}
      >
        <Text style={styles.buttonText}>Upgrade to Yearly</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.primary + "10",
      borderRadius: radius.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: c.primary + "30",
      ...shadow.card,
      marginBottom: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    title: {
      ...typography.title2,
      color: c.primary,
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    button: {
      backgroundColor: c.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: radius.md,
      alignItems: "center",
      alignSelf: "flex-start",
    },
    buttonText: {
      ...typography.body,
      fontWeight: "600",
      color: "#FFFFFF",
    },
  });
