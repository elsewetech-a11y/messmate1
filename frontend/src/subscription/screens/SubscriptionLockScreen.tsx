import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, SafeAreaView, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, typography, useTheme, type ThemeColors } from "@/src/theme";
import { Button } from "@/src/components/Button";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import type { SubscriptionPublic } from "@/src/api/client";
import { formatISOasDateIST } from "@/src/utils/istDate";

type SubscriptionLockScreenProps = {
  role: "admin" | "student";
  institutionName?: string;
  subscription?: SubscriptionPublic;
  isRenewing?: boolean;
  onRenew?: () => void;
};

export function SubscriptionLockScreen({ role, institutionName, subscription, isRenewing, onRenew }: SubscriptionLockScreenProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const [isSupportModalVisible, setSupportModalVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Feather name="lock" size={48} color={c.danger} />
        </View>
        
        {role === "admin" ? (
          <>
            <Text style={styles.title}>Subscription Expired</Text>
            <Text style={styles.subtitle}>
              Your MessMate subscription for {institutionName || "your institution"} has expired. 
              Renew your subscription to continue managing your institution.
            </Text>

            {subscription && (
              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Current Plan:</Text>
                  <Text style={styles.detailValue}>{subscription.is_trial ? "Free Trial" : "Premium"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Expiry Date:</Text>
                  <Text style={styles.detailValue}>{subscription.expiry_date ? formatISOasDateIST(subscription.expiry_date) : "N/A"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Student Capacity:</Text>
                  <Text style={styles.detailValue}>{subscription.student_limit} Students</Text>
                </View>
              </View>
            )}

            <View style={styles.actions}>
              <Button 
                label="Renew Subscription"
                onPress={() => router.push("/(admin)/subscription")}
                style={styles.primaryButton}
              />
              <Button 
                label="Contact Support"
                onPress={() => setSupportModalVisible(true)}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Service Temporarily Unavailable</Text>
            <Text style={styles.subtitle}>
              Your institution's subscription has expired. Please contact your hostel administrator to restore access.
            </Text>

            <View style={styles.supportBox}>
              <Text style={styles.supportLabel}>Support:</Text>
              <Text style={styles.supportEmail}>elsewe.tech@gmail.com</Text>
            </View>
          </>
        )}
      </View>

      <Modal
        visible={isSupportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Contact Support</Text>
            <Text style={styles.modalBody}>
              For any subscription or technical support, please contact us at:
            </Text>
            <Text style={styles.modalEmail}>elsewe.tech@gmail.com</Text>
            
            <View style={styles.modalActions}>
              <Button 
                label="Copy Email" 
                onPress={async () => {
                  await Clipboard.setStringAsync('elsewe.tech@gmail.com');
                  setSupportModalVisible(false);
                }} 
                style={styles.primaryButton}
              />
              <Button 
                label="Close" 
                onPress={() => setSupportModalVisible(false)} 
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: c.bg,
    },
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.dangerTint,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 32,
    },
    title: {
      ...typography.title1,
      color: c.textPrimary,
      textAlign: "center",
      marginBottom: 16,
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 40,
    },
    actions: {
      width: "100%",
      marginTop: 24,
      gap: 12,
    },
    primaryButton: {
      backgroundColor: c.primary,
    },
    detailsCard: {
      width: "100%",
      backgroundColor: c.card,
      padding: 16,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      marginVertical: 16,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    detailLabel: {
      ...typography.caption,
      color: c.textSecondary,
    },
    detailValue: {
      ...typography.caption,
      color: c.textPrimary,
      fontWeight: "600",
    },
    supportBox: {
      marginTop: 24,
      padding: 16,
      backgroundColor: c.bg2,
      borderRadius: radius.md,
      alignItems: "center",
      width: "100%",
      borderWidth: 1,
      borderColor: c.border,
    },
    supportLabel: {
      ...typography.caption,
      color: c.textSecondary,
      marginBottom: 4,
    },
    supportEmail: {
      ...typography.body,
      fontWeight: "700",
      color: c.textPrimary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalContent: {
      backgroundColor: c.bg,
      borderRadius: radius.lg,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    modalTitle: {
      ...typography.title2,
      color: c.textPrimary,
      marginBottom: 16,
    },
    modalBody: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: 16,
    },
    modalEmail: {
      ...typography.headline,
      color: c.primary,
      marginBottom: 24,
    },
    modalActions: {
      width: "100%",
      gap: 12,
    },
  });
