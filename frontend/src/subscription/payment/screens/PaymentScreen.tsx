import React, { useState, useMemo, useEffect } from "react";
import { StyleSheet, View, Text, SafeAreaView, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/src/auth/AuthContext";
import { PaymentSummary } from "../components/PaymentSummary";
import { paymentService } from "../services/paymentService";
import { useSubscription } from "../../hooks/useSubscription";
import { Button } from "@/src/components/Button";
import { radius, spacing, typography, useTheme, type ThemeColors } from "@/src/theme";
import type { OrderCreateRequest, OrderCreateResponse } from "@/src/api/client";

export function PaymentScreen() {
  const { plan_type, student_count } = useLocalSearchParams();
  const { token, user } = useAuth();
  const router = useRouter();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { refreshStatus } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const plan: OrderCreateRequest = {
    plan_type: (plan_type as "monthly" | "yearly") || "monthly",
    student_count: parseInt((student_count as string) || "500", 10)
  };

  const amount = plan.plan_type === "monthly" ? plan.student_count * 2.0 : plan.student_count * 1.5 * 12;

  const handlePayment = async () => {
    if (!token || !user) return;
    let currentOrderId: string | null = null;

    try {
      setLoading(true);
      setError(null);
      
      // 1. Create Order
      const order = await paymentService.createOrder(token, plan);
      currentOrderId = order.order_id;
      
      // 2. Process Payment via Provider (Mock)
      const { paymentId, signature } = await paymentService.processPayment(
        order,
        user.email,
        user.institution_or_hostel_name
      );

      // 3. Verify Payment with backend
      await paymentService.verifyPayment(token, {
        order_id: order.order_id,
        payment_id: paymentId,
        signature
      });

      // 4. Success!
      setSuccess(true);
      await refreshStatus();

    } catch (err: any) {
      const errMsg = err.message || "Payment failed. Please try again.";
      if (currentOrderId) {
        // Report failure to backend async
        paymentService.reportPaymentFailed(token, currentOrderId, errMsg).catch(console.error);
        router.push(`/(admin)/payment-failed?reason=${encodeURIComponent(errMsg)}&order_id=${currentOrderId}` as any);
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <View style={styles.successCircle}>
            <Feather name="check" size={48} color={c.success} />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>
            Your subscription is now active. You can download the invoice from the Billing dashboard.
          </Text>
          <Button 
            label="Go to Dashboard" 
            onPress={() => router.replace("/(admin)/dashboard")}
            style={{ marginTop: 24, minWidth: 200 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Checkout</Text>
        <Text style={styles.headerSubtitle}>Review your plan details and complete the payment.</Text>

        <PaymentSummary 
          institutionName={user?.institution_or_hostel_name || ""}
          plan={plan}
          amount={amount}
        />

        {error && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={c.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button 
          label={loading ? "Processing..." : `Pay ₹${amount.toFixed(2)}`}
          onPress={handlePayment}
          disabled={loading}
          style={styles.payButton}
        />
        
        <Text style={styles.secureText}>
          <Feather name="lock" size={12} /> Secure Payment Processing
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { padding: 24 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    headerTitle: { ...typography.title2, color: c.textPrimary, marginBottom: 8 },
    headerSubtitle: { ...typography.body, color: c.textSecondary, marginBottom: 24 },
    payButton: { backgroundColor: c.primary, marginTop: 16 },
    secureText: { ...typography.caption, color: c.textSecondary, textAlign: "center", marginTop: 16 },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.dangerTint,
      padding: 12,
      borderRadius: radius.sm,
      marginBottom: 16,
      gap: 8,
    },
    errorText: { ...typography.subhead, color: c.danger, flex: 1 },
    successCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.success + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 32,
    },
    successTitle: { ...typography.title1, color: c.textPrimary, marginBottom: 16, textAlign: "center" },
    successSubtitle: { ...typography.body, color: c.textSecondary, textAlign: "center", lineHeight: 24 },
  });
