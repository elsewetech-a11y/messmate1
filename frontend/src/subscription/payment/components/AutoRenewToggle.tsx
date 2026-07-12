import React, { useState } from "react";
import { StyleSheet, View, Text, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, spacing, typography, useTheme, type ThemeColors } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";
import { paymentService } from "../../payment/services/paymentService";
import { api } from "@/src/api/client";

interface AutoRenewToggleProps {
  initialState: boolean;
  onStateChange?: (newState: boolean) => void;
}

export function AutoRenewToggle({ initialState, onStateChange }: AutoRenewToggleProps) {
  const [isEnabled, setIsEnabled] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const { c } = useTheme();
  const styles = makeStyles(c);
  const { token } = useAuth();

  const toggleSwitch = async () => {
    if (!token || loading) return;
    
    const newState = !isEnabled;
    // Optimistic update
    setIsEnabled(newState);
    setLoading(true);

    try {
      await api.toggleAutoRenew(token, { enabled: newState });
      onStateChange?.(newState);
    } catch (error) {
      console.error("Failed to toggle auto renew:", error);
      // Revert on failure
      setIsEnabled(!newState);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <View style={styles.header}>
          <Feather name="refresh-cw" size={18} color={c.textPrimary} />
          <Text style={styles.title}>Auto Renewal</Text>
        </View>
        <Text style={styles.description}>
          {isEnabled 
            ? "Your subscription will automatically renew on the billing date." 
            : "We will send you a reminder before your subscription expires."}
        </Text>
      </View>
      <Switch
        trackColor={{ false: c.border, true: c.primary }}
        thumbColor={"#FFFFFF"}
        ios_backgroundColor={c.border}
        onValueChange={toggleSwitch}
        value={isEnabled}
        disabled={loading}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.card,
      padding: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.lg,
    },
    infoContainer: {
      flex: 1,
      marginRight: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    title: {
      ...typography.headline,
      color: c.textPrimary,
      marginLeft: spacing.sm,
    },
    description: {
      ...typography.subhead,
      color: c.textSecondary,
    },
  });
