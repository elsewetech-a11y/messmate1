import React from "react";
import { StyleSheet, TouchableOpacity, Text } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { radius, typography, useTheme } from "@/src/theme";
import type { BillingCycle } from "../../hooks/useSubscriptionCalculator";

type PaymentButtonProps = {
  plan: BillingCycle;
  students: number;
  disabled?: boolean;
};

export function PaymentButton({ plan, students, disabled }: PaymentButtonProps) {
  const router = useRouter();
  const { c } = useTheme();

  return (
    <TouchableOpacity 
      style={[styles.button, { backgroundColor: disabled ? c.border : c.primary }]}
      disabled={disabled}
      onPress={() => router.push(`/(admin)/payment?plan_type=${plan}&student_count=${students}` as any)}
    >
      <Text style={styles.text}>Continue to Payment</Text>
      <Feather name="arrow-right" size={18} color="#FFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: 16,
    gap: 8,
  },
  text: {
    ...typography.subhead,
    color: "#FFF",
    fontWeight: "700",
  },
});
