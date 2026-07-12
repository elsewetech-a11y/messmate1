import React from "react";
import { View, ActivityIndicator } from "react-native";
import { useSubscription } from "../hooks/useSubscription";
import { SubscriptionLockScreen } from "../screens/SubscriptionLockScreen";
import { useTheme } from "@/src/theme";

type SubscriptionGuardProps = {
  children: React.ReactNode;
  role: "admin" | "student";
};

export function SubscriptionGuard({ children, role }: SubscriptionGuardProps) {
  const { loading, canAccessFeatures, subscription, renew } = useSubscription();
  const { c } = useTheme();

  if (loading && !subscription) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (!canAccessFeatures) {
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
