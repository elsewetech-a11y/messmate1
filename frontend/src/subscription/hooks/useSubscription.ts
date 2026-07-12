import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/src/auth/AuthContext";
import { subscriptionService } from "../services/subscriptionService";
import type { SubscriptionPublic, SubscriptionStatus } from "@/src/api/client";
import { useFocusEffect } from "expo-router";

export function useSubscription() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionPublic | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await subscriptionService.checkSubscriptionStatus(token);
      setSubscription(data);
      setError(null);
    } catch (err: any) {
      if (err.message === "SUBSCRIPTION_EXPIRED") {
        // Handle gracefully
        setSubscription({
          institution_or_hostel_name: "",
          status: "SUBSCRIPTION_EXPIRED",
          is_trial: false,
          days_remaining: 0,
          student_limit: 500,
          registered_students: 0,
          expiry_date: undefined
        });
      } else {
        setError(err.message || "Failed to fetch subscription status");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch on mount and when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchStatus();
    }, [fetchStatus])
  );

  const renew = async () => {
    if (!token) return;
    try {
      setLoading(true);
      await subscriptionService.renewSubscription(token);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || "Failed to renew subscription");
      setLoading(false);
    }
  };

  const isActive = subscription?.status === "ACTIVE" || subscription?.status === "TRIAL_ACTIVE";
  
  // According to rules, even if grace period is active, or similar we block operational data.
  // We'll map "canAccessFeatures" based on exactly whether it's ACTIVE or TRIAL_ACTIVE
  const canAccessFeatures = isActive;

  return {
    subscription,
    loading,
    error,
    isActive,
    isTrial: subscription?.is_trial || false,
    daysRemaining: subscription?.days_remaining || 0,
    expiryDate: subscription?.expiry_date || null,
    studentLimit: subscription?.student_limit || 500,
    canAccessFeatures,
    renew,
    refreshStatus: fetchStatus
  };
}
