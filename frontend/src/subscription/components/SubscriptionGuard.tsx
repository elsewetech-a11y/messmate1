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
  const { c } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!loading && subscription && !canAccessFeatures && role === "admin") {
      router.replace("/(admin)/subscription" as any);
    }
  }, [loading, subscription, canAccessFeatures, role, router]);

  if (loading && !subscription) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (!canAccessFeatures) {
    if (role === "admin") {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      );
    }
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

