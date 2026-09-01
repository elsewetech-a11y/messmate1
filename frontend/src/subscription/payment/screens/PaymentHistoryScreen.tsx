import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, View, Text, SafeAreaView, FlatList, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/src/auth/AuthContext";
import { paymentService } from "../services/paymentService";
import { TransactionCard } from "../components/TransactionCard";
import type { TransactionPublic } from "@/src/api/client";
import { radius, typography, useTheme, type ThemeColors } from "@/src/theme";

export function PaymentHistoryScreen() {
  const { token } = useAuth();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [transactions, setTransactions] = useState<TransactionPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async (showSpinner = false) => {
    if (!token) return;
    try {
      if (showSpinner) setLoading(true);
      const data = await paymentService.getPaymentHistory(token);
      setTransactions(data);
    } catch (err) {
      console.warn("Failed to fetch transactions", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions(transactions.length === 0);
    }, [fetchTransactions, transactions.length])
  );

  const handleDownload = (transaction: TransactionPublic) => {
    // In a real app, this would use expo-sharing or Linking to download the PDF
    Alert.alert("Invoice Download", `Invoice has been downloaded to your device for order ${transaction.order_id}.`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionCard transaction={item} onDownload={item.status === 'SUCCESS' ? handleDownload : undefined} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="file" size={48} color={c.border} />
            <Text style={styles.emptyText}>No invoices found</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Billing History</Text>
            <Text style={styles.subtitle}>View your past payments and download invoices.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { padding: 24, paddingBottom: 64 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { marginBottom: 24 },
    title: { ...typography.title2, color: c.textPrimary, marginBottom: 8 },
    subtitle: { ...typography.body, color: c.textSecondary },
    emptyBox: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
    emptyText: { ...typography.body, color: c.textSecondary, marginTop: 16 },
  });
