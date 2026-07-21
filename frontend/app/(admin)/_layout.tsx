import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native";

import { useTheme } from "@/src/theme";
import { SubscriptionBanner } from "@/src/subscription/components/SubscriptionBanner";
import { GlassTabBar, type TabIconMap } from "@/src/components/GlassTabBar";

const ADMIN_ICONS: TabIconMap = {
  "students-status": "users",
  dashboard: "grid",
  "wastage-calc": "bar-chart-2",
  "necessary-info": "clipboard",
  settings: "settings",
};

export default function AdminTabsLayout() {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <SubscriptionBanner />
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} icons={ADMIN_ICONS} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.textSecondary,
          sceneStyle: { backgroundColor: c.bg },
        }}
      >
        <Tabs.Screen
          name="students-status"
          options={{
            title: "Students",
            tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="wastage-calc"
          options={{
            title: "Wastage",
            tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="necessary-info"
          options={{
            title: "Info",
            tabBarIcon: ({ color, size }) => <Feather name="clipboard" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="subscription" options={{ href: null }} />
        <Tabs.Screen name="billing" options={{ href: null }} />
        <Tabs.Screen name="payment" options={{ href: null }} />
        <Tabs.Screen name="payment-failed" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}
