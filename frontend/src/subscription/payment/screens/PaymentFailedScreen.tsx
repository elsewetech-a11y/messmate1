import React from "react";
import { StyleSheet, Text, View, SafeAreaView, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Button } from "@/src/components/Button";
import { radius, spacing, typography, useTheme, type ThemeColors } from "@/src/theme";

export function PaymentFailedScreen() {
  const { reason } = useLocalSearchParams();
  const router = useRouter();
  const { c } = useTheme();
  const styles = makeStyles(c);

  const displayReason = reason || "Bank declined the transaction.";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.errorCircle}>
          <Feather name="x" size={48} color={c.danger} />
        </View>
        <Text style={styles.title}>Payment Failed</Text>
        
        <Text style={styles.subtitle}>
          Unfortunately, your payment could not be completed.
        </Text>
        
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reason:</Text>
          <Text style={styles.reasonText}>{displayReason}</Text>
        </View>

        <Text style={styles.infoText}>
          Your current subscription has not been changed.
          You can retry the payment or contact support if the issue persists.
        </Text>

        <View style={styles.actions}>
          <Button 
            label="Retry Payment" 
            onPress={() => router.back()} // Go back to payment summary
            style={styles.retryButton}
          />
          <Button 
            label="Contact Support" 
            variant="secondary"
            onPress={() => Linking.openURL('mailto:elsewe.tech@gmail.com')}
            style={styles.supportButton}
          />
        </View>

        <Text style={styles.supportContact}>
          Support Email: elsewe.tech@gmail.com
        </Text>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
    errorCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.dangerTint,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    title: { ...typography.title1, color: c.textPrimary, marginBottom: spacing.md, textAlign: "center" },
    subtitle: { ...typography.body, color: c.textSecondary, textAlign: "center", marginBottom: spacing.lg },
    reasonBox: {
      backgroundColor: c.card,
      padding: spacing.md,
      borderRadius: radius.md,
      width: "100%",
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: c.border,
    },
    reasonLabel: { ...typography.subhead, color: c.textSecondary, marginBottom: spacing.xs },
    reasonText: { ...typography.body, color: c.textPrimary, fontWeight: "500" },
    infoText: { ...typography.body, color: c.textSecondary, textAlign: "center", marginBottom: spacing.xxl, lineHeight: 22 },
    actions: { width: "100%", gap: spacing.md },
    retryButton: { backgroundColor: c.primary },
    supportButton: { borderColor: c.border },
    supportContact: { ...typography.caption, color: c.textSecondary, marginTop: spacing.xl },
  });
