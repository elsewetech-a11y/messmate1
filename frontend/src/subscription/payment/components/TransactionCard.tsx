import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, spacing, typography, useTheme, type ThemeColors } from "@/src/theme";
import type { TransactionPublic } from "@/src/api/client";

type TransactionCardProps = {
  transaction: TransactionPublic;
  onDownload?: (transaction: TransactionPublic) => void;
};

export function TransactionCard({ transaction, onDownload }: TransactionCardProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const isSuccess = transaction.status === "SUCCESS";
  const isFailed = transaction.status === "FAILED";

  const statusColor = isSuccess ? c.success : isFailed ? c.danger : c.warning;
  const statusBg = isSuccess ? c.success + "20" : isFailed ? c.danger + "20" : c.warning + "20";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: statusBg }]}>
          <Feather name={isSuccess ? "check-circle" : isFailed ? "x-circle" : "clock"} size={20} color={statusColor} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.orderNumber}>{transaction.order_id}</Text>
          <Text style={styles.date}>
            {transaction.transaction_date 
              ? new Date(transaction.transaction_date).toLocaleString() 
              : "Pending"}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {transaction.status}
          </Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Plan / Action</Text>
          <Text style={[styles.detailValue, { textTransform: "capitalize", fontWeight: "600", color: c.textPrimary }]}>
            {transaction.action === "CAPACITY_UPGRADE" ? "Upgrade" : transaction.plan_type}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Students</Text>
          <Text style={styles.detailValue}>{transaction.student_count}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Amount</Text>
          <Text style={styles.detailValue}>₹{transaction.amount}</Text>
        </View>
      </View>
      
      {isFailed && transaction.error_message && (
        <View style={styles.errorRow}>
          <Text style={styles.errorLabel}>Reason:</Text>
          <Text style={styles.errorValue}>{transaction.error_message}</Text>
        </View>
      )}

      {onDownload && (
        <TouchableOpacity style={styles.downloadBtn} onPress={() => onDownload(transaction)}>
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
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    titleContainer: {
      flex: 1,
    },
    orderNumber: {
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
    errorRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.dangerTint,
      padding: 8,
      borderRadius: radius.sm,
      marginBottom: 12,
    },
    errorLabel: {
      ...typography.caption,
      color: c.danger,
      fontWeight: "700",
      marginRight: 8,
    },
    errorValue: {
      ...typography.caption,
      color: c.danger,
      flex: 1,
    },
    downloadBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      backgroundColor: c.primaryTint,
      borderRadius: radius.sm,
    },
    downloadText: {
      ...typography.subhead,
      color: c.primary,
      fontWeight: "600",
      marginLeft: 8,
    },
  });
