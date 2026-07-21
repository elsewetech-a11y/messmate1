import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import { useTheme } from "@/src/theme";
import { SubscriptionGuard } from "@/src/subscription/components/SubscriptionGuard";
import { GlassTabBar, type TabIconMap } from "@/src/components/GlassTabBar";

const STUDENT_ICONS: TabIconMap = {
  home: "home",
  menu: "calendar",
  wastage: "pie-chart",
  settings: "settings",
};

export default function StudentTabsLayout() {
  const { c } = useTheme();
  return (
    <SubscriptionGuard role="student">
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} icons={STUDENT_ICONS} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.textSecondary,
          sceneStyle: { backgroundColor: c.bg },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: "Menu",
            tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="wastage"
          options={{
            title: "Wastage",
            tabBarIcon: ({ color, size }) => <Feather name="pie-chart" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} />,
          }}
        />
      </Tabs>
    </SubscriptionGuard>
  );
}
