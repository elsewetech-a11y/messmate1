import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, spacing, typography, useTheme, type ThemeColors } from "@/src/theme";
import type { InvoicePublic } from "@/src/api/client";
import { formatISOasDateIST } from "@/src/utils/istDate";

type InvoiceCardProps = {
  invoice: InvoicePublic;
  onDownload?: (invoice: InvoicePublic) => void;
};

export function InvoiceCard({ invoice, onDownload }: InvoiceCardProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="file-text" size={20} color={c.primary} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
          <Text style={styles.date}>{formatISOasDateIST(invoice.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: invoice.status === "Paid" ? c.success + "20" : c.warning + "20" }]}>
          <Text style={[styles.statusText, { color: invoice.status === "Paid" ? c.success : c.warning }]}>
            {invoice.status}
          </Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Plan</Text>
          <Text style={[styles.detailValue, { textTransform: "capitalize", fontWeight: "600", color: c.textPrimary }]}>
            {invoice.plan_type}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Students</Text>
          <Text style={styles.detailValue}>{invoice.student_count}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Amount</Text>
          <Text style={styles.detailValue}>₹{invoice.amount}</Text>
        </View>
      </View>

      <View style={styles.periodRow}>
        <Text style={styles.periodLabel}>Period:</Text>
        <Text style={styles.periodValue}>{invoice.subscription_period}</Text>
      </View>

      {onDownload && (
        <TouchableOpacity style={styles.downloadBtn} onPress={() => onDownload(invoice)}>
          <Feather name="download" size={16} color={c.primary} />
          <Text style={styles.downloadText}>Download Invoice</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bg2,
      borderRadius: radius.md,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    titleContainer: {
      flex: 1,
    },
    invoiceNumber: {
      ...typography.subhead,
      color: c.textPrimary,
      fontWeight: "700",
    },
    date: {
      ...typography.caption,
      color: c.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      ...typography.caption,
      fontWeight: "700",
    },
    detailsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: c.bg,
      padding: 12,
      borderRadius: radius.sm,
      marginBottom: 12,
    },
    detailItem: {
      flex: 1,
    },
    detailLabel: {
      ...typography.caption,
      color: c.textSecondary,
      marginBottom: 4,
    },
    detailValue: {
      ...typography.subhead,
      color: c.textPrimary,
      fontWeight: "600",
    },
    periodRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    periodLabel: {
      ...typography.caption,
      color: c.textSecondary,
      marginRight: 8,
    },
    periodValue: {
      ...typography.caption,
      color: c.textPrimary,
      fontWeight: "500",
    },
    downloadBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: radius.sm,
      gap: 8,
    },
    downloadText: {
      ...typography.subhead,
      color: c.primary,
      fontWeight: "600",
    },
  });
