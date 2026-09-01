import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSubscription } from "../hooks/useSubscription";
import { SubscriptionLockScreen } from "../screens/SubscriptionLockScreen";
import { useTheme } from "@/src/theme";

type SubscriptionGuardProps = {
  children: React.ReactNode;
  role: "admin" | "student";
};

export function SubscriptionGuard({ children, role }: SubscriptionGuardProps) {
  const { loading, canAccessFeatures, subscription, renew } = useSubscription();

  // Admin always has access to UI, with top SubscriptionBanner indicating plan status
  if (role === "admin") {
    return <>{children}</>;
  }

  // If subscription is confirmed expired for student, display the lock screen
  if (!loading && subscription && !canAccessFeatures) {
    return (
      <SubscriptionLockScreen 
        role={role} 
        institutionName={subscription?.institution_or_hostel_name}
        subscription={subscription || undefined}
        isRenewing={loading}
        onRenew={renew}
      />
    );
  }

  return <>{children}</>;
}

