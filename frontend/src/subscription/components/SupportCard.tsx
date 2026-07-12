import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, typography, useTheme, type ThemeColors } from "@/src/theme";

export function SupportCard() {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const handleEmailPress = () => {
    Linking.openURL("mailto:elsewe.tech@gmail.com?subject=MessMate Subscription Support");
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Feather name="headphones" size={24} color={c.primary} />
      </View>

      <Text style={styles.title}>Need Help?</Text>

      <Text style={styles.description}>
        If you experience any issues with subscription purchases, payment failures, billing
        questions, invoice requests, or renewal problems, our support team is here to assist you.
      </Text>

      <TouchableOpacity
        style={styles.emailContainer}
        onPress={handleEmailPress}
        activeOpacity={0.7}
        testID="support-email-btn"
      >
        <Feather name="mail" size={18} color={c.primary} />
        <Text style={styles.emailText}>elsewe.tech@gmail.com</Text>
        <Feather name="external-link" size={14} color={c.primary} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bg2,
      borderRadius: radius.md,
      padding: 24,
      alignItems: "center",
      marginTop: 8,
      marginBottom: 40, // extra padding at bottom of screen
      borderWidth: 1,
      borderColor: c.border,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.primaryLight,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    title: {
      ...typography.title2,
      color: c.textPrimary,
      marginBottom: 8,
    },
    description: {
      ...typography.body,
      color: c.textSecondary,
      marginBottom: 20,
      textAlign: "center",
      lineHeight: 22,
    },
    emailContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.primaryTint,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: radius.pill,
    },
    emailText: {
      ...typography.body,
      fontWeight: "600",
      color: c.primaryDark,
    },
  });
