// Privacy Policy screen — full scrollable policy text.

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { spacing, typography, useTheme, type ThemeColors } from "@/src/theme";

type Section = { heading: string; body: string };

const SECTIONS: Section[] = [
  {
    heading: "1. Introduction",
    body: "MessMate is a meal-planning and feedback platform for hostels and student residences. This Privacy Policy explains how we collect, use, store, and protect personal information of users (students, staff, and administrators) in accordance with applicable Indian data-protection laws.",
  },
  {
    heading: "2. Information We Collect",
    body: "• Personal Identifiers — Student ID, name, email, phone number (where voluntarily provided) — for account creation, authentication, and communication.\n\n• Meal-Plan Data — Selected items, status (ON/OFF), reasons, and custom answers — to generate daily meal quantities and admin dashboards.\n\n• Reactions — Like / Dislike / No response to meals — to adjust quantity multipliers and analytics.\n\n• Device & Usage Data — IP address, browser/OS info, timestamps, crash logs — for security and performance monitoring.\n\n• Location (optional) — Approximate location derived from IP — to improve regional service availability.",
  },
  {
    heading: "3. How We Use Your Data",
    body: "• Operational — To compute daily quantities, manage meal status, and power the admin dashboard.\n\n• Analytics — Aggregate statistics are used for service improvement and are never shared with personally-identifiable information.\n\n• Communications — To send OTPs, password-reset links, and important service notices.\n\n• Legal & Safety — To comply with legal obligations, prevent fraud, and enforce our Terms.",
  },
  {
    heading: "4. Data Sharing & Disclosure",
    body: "• Internal — Shared only with authorized staff (e.g., hostel admins) who need it to run the service.\n\n• Third-Party Service Providers — Cloud hosting, email/SMS delivery, and analytics providers. They are contractually bound to protect data.\n\n• Legal Requirements — May be disclosed to law-enforcement or regulators when required by law.",
  },
  {
    heading: "5. Data Retention",
    body: "• Active Accounts — Data retained for the duration of the account.\n\n• Deleted Accounts — Personal identifiers are removed within 30 days; aggregated meal data may be retained for analytics.\n\n• Logs — Server logs are kept for 90 days.",
  },
  {
    heading: "6. Security Measures",
    body: "• TLS encryption for data in transit.\n\n• AES-256 encryption at rest for sensitive fields.\n\n• Role-based access control, regular security audits, and vulnerability scanning.",
  },
  {
    heading: "7. Your Rights",
    body: "• Access & Portability — Request a copy of your data.\n\n• Correction — Update inaccurate information via app settings.\n\n• Deletion — Request account deletion.\n\n• Objection — Opt-out of non-essential communications.\n\nRequests can be sent to: privacy@messmate.app",
  },
  {
    heading: "8. Children's Privacy",
    body: "The App is intended for users 18 years and older. If we become aware of data from minors, we will delete it promptly.",
  },
  {
    heading: "9. International Transfers",
    body: "Data is hosted on servers located in India. No transfer outside India unless required for third-party services, in which case appropriate safeguards apply.",
  },
  {
    heading: "10. Changes to This Policy",
    body: "We may update this policy. Changes will be posted within the app and emailed to registered users. Continued use after changes constitutes acceptance.",
  },
  {
    heading: "11. Contact",
    body: "MessMate Support\nEmail: privacy@messmate.app\nAddress: 123 Campus Road, University Town, India\nPhone: +91-98765-43210",
  },
];

export default function PrivacyPolicy() {
  const router = useRouter();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="privacy-back"
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="chevron-left" size={24} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.effectiveDate}>Effective Date: July 4, 2026</Text>

        {SECTIONS.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{s.heading}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            If you have any questions, email us at{" "}
            <Text style={styles.footerLink}>privacy@messmate.app</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
      backgroundColor: c.bg,
    },
    backBtn: {
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      ...typography.headline,
      color: c.textPrimary,
      fontWeight: "700",
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2,
    },
    effectiveDate: {
      ...typography.footnote,
      color: c.textTertiary,
      marginBottom: spacing.lg,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionHeading: {
      ...typography.headline,
      color: c.primary,
      fontWeight: "700",
      marginBottom: spacing.xs,
    },
    sectionBody: {
      ...typography.callout,
      color: c.textSecondary,
      lineHeight: 22,
    },
    footer: {
      marginTop: spacing.xl,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.divider,
    },
    footerText: {
      ...typography.footnote,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    footerLink: {
      color: c.primary,
      fontWeight: "600",
    },
  });
