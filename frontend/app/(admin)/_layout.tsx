// Admin tab navigator — 5 tabs, liquid-glass floating pill.

import { Tabs } from "expo-router";
import React from "react";
import { View, SafeAreaView } from "react-native";

import { GlassTabBar, type TabIconMap } from "@/src/components/GlassTabBar";
import { useTheme } from "@/src/theme";
import { SubscriptionBanner } from "@/src/subscription/components/SubscriptionBanner";

const icons: TabIconMap = {
  "students-status": "users",
  dashboard: "grid",
  "wastage-calc": "bar-chart-2",
  subscription: "credit-card",
  "necessary-info": "clipboard",
  settings: "settings",
};

export default function AdminTabsLayout() {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <SubscriptionBanner />
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} icons={icons} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: c.bg },
        }}
      >
        <Tabs.Screen name="students-status" options={{ title: "Students" }} />
        <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
        <Tabs.Screen name="wastage-calc" options={{ title: "Wastage" }} />
        <Tabs.Screen name="subscription" options={{ title: "Plan", href: null }} />
        <Tabs.Screen name="billing" options={{ href: null }} />
        <Tabs.Screen name="payment" options={{ href: null }} />
        <Tabs.Screen name="payment-failed" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="necessary-info" options={{ title: "Info" }} />
        <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      </Tabs>
    </SafeAreaView>
  );
}
