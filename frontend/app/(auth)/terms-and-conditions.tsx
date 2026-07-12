// Terms and Conditions screen — full scrollable terms text.

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
    heading: "1. Acceptance of Terms",
    body: "By registering for or using the MessMate application (\"App\"), you (\"User\") agree to be bound by these Terms and Conditions. If you do not agree, please do not use the App.\n\nThese Terms apply to all users — students, hostel staff, and administrators.",
  },
  {
    heading: "2. Eligibility",
    body: "• You must be 18 years of age or older to use this App.\n\n• You must be an enrolled student or authorized staff member of a hostel/institution registered on MessMate.\n\n• Your account must be approved by a hostel administrator before you can access the App.",
  },
  {
    heading: "3. User Accounts",
    body: "• You are responsible for maintaining the confidentiality of your credentials (username, password, OTP).\n\n• You must not share your account with any other person.\n\n• You must provide accurate and up-to-date information during registration.\n\n• We reserve the right to suspend or terminate accounts that violate these Terms or misuse the App.",
  },
  {
    heading: "4. Acceptable Use",
    body: "Users agree NOT to:\n\n• Submit false or misleading meal plans or feedback.\n\n• Attempt to hack, reverse-engineer, or disrupt the App or its servers.\n\n• Use the App for any commercial, unauthorized, or illegal purpose.\n\n• Impersonate another student, staff member, or administrator.\n\n• Exploit any system bugs, glitches, or loopholes.\n\nAny such activity may result in immediate account suspension and legal action.",
  },
  {
    heading: "5. Meal Planning & Quantity Calculations",
    body: "• The daily meal status (ON/OFF), item selections, and reactions you submit are used to calculate preparation quantities for the hostel kitchen.\n\n• You are expected to submit your daily meal plan by the cutoff time set by your hostel administrator.\n\n• Late or missing submissions may be counted as 100% participation for quantity-planning purposes.\n\n• MessMate does not guarantee meal availability beyond calculated estimates — the hostel management is solely responsible for physical meal preparation and distribution.",
  },
  {
    heading: "6. Reactions and Feedback",
    body: "• Like/Dislike reactions to meals are anonymous in aggregate but are linked to your account for quality improvement purposes.\n\n• Feedback submitted through the App is the property of MessMate and may be used to improve services.\n\n• Abusive, offensive, or inappropriate responses may result in account suspension.",
  },
  {
    heading: "7. Administrator Responsibilities",
    body: "Hostel administrators agree to:\n\n• Use the dashboard and data only for legitimate hostel management purposes.\n\n• Not disclose student meal data to unauthorized third parties.\n\n• Ensure that meal quantities prepared are based on the App's guidance alongside their own professional judgment — MessMate's quantity suggestions are advisory only.",
  },
  {
    heading: "8. Intellectual Property",
    body: "All content, design, code, and features of the MessMate App are the intellectual property of MessMate or its licensors. Users may not copy, reproduce, or distribute any part of the App without prior written permission.",
  },
  {
    heading: "9. Limitation of Liability",
    body: "MessMate is provided \"as is\". To the maximum extent permitted by law:\n\n• We are not liable for any inaccuracies in meal quantity estimates.\n\n• We are not responsible for meal shortfalls or wastage resulting from inaccurate user input.\n\n• We are not liable for losses arising from service downtime, data loss, or technical errors.",
  },
  {
    heading: "10. Availability & Changes",
    body: "• We reserve the right to modify, suspend, or discontinue any feature of the App at any time.\n\n• We may update these Terms at any time. Users will be notified of significant changes via email or in-app notification.\n\n• Continued use of the App after changes constitutes acceptance of the updated Terms.",
  },
  {
    heading: "11. Governing Law & Dispute Resolution",
    body: "• These Terms are governed by the laws of the Republic of India.\n\n• Any disputes shall be subject to the exclusive jurisdiction of the courts of India.\n\n• We encourage resolving disputes informally first by contacting us at support@messmate.app.",
  },
  {
    heading: "12. Contact",
    body: "MessMate Support Team\nEmail: support@messmate.app\nAddress: 123 Campus Road, University Town, India\nPhone: +91-98765-43210",
  },
];

export default function TermsAndConditions() {
  const router = useRouter();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="terms-back"
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="chevron-left" size={24} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
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
            By using MessMate, you confirm that you have read, understood, and
            agreed to these Terms and Conditions.
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
      fontStyle: "italic",
    },
  });
