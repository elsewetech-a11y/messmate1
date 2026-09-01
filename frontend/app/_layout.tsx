import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import React, { useEffect } from "react";
import { DeviceEventEmitter, LogBox, Platform, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth, useAuthRouting } from "@/src/auth/AuthContext";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ThemeProvider, useTheme } from "@/src/theme";
import { ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { registerForPush } from "@/src/utils/notifications";
import { useRealtimeSync, REALTIME_EVENT } from "@/src/api/useRealtimeSync";
import { api } from "@/src/api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { enableFreeze } from "react-native-screens";

enableFreeze(false);

LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Push notification setup \u2014 MUST be at module scope (per Emergent playbook).
// ---------------------------------------------------------------------------
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

if (Platform.OS === "android") {
  // Fire-and-forget; channel must exist before any push arrives.
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  }).catch(() => {});
  Notifications.setNotificationChannelAsync("reminders", {
    name: "Meal reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  }).catch(() => {});
}

function RoutingShell() {
  useAuthRouting();
  const { c, isDark } = useTheme();
  const navTheme = {
    dark: isDark,
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: c.primary,
      background: c.bg,
      card: c.card,
      text: c.textPrimary,
      border: c.border,
      notification: c.primary,
    },
    fonts: isDark ? DarkTheme.fonts : DefaultTheme.fonts,
  };

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={c.bg}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: c.bg },
          freezeOnBlur: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen
          name="notifications"
          options={
            Platform.OS === "web"
              ? { animation: "fade" }
              : { presentation: "modal", animation: "slide_from_bottom" }
          }
        />
        <Stack.Screen
          name="notification/[id]"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom"
          }}
        />
      </Stack>
    </NavThemeProvider>
  );
}

function PushBridge() {
  const router = useRouter();
  const { token, user } = useAuth();

  // Register the device token whenever an authenticated user is active.
  useEffect(() => {
    if (!token || !user) return;
    registerForPush(token, user.id).catch(() => {});

    // Listen to token updates/rotations from Firebase
    const tokenSub = Notifications.addPushTokenListener((tokenData) => {
      const freshToken = tokenData?.data;
      if (freshToken && token && user) {
        const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
        api.savePushToken(token, { push_token: String(freshToken), platform }).catch(() => {});
        api.registerPush(token, { user_id: user.id, platform, device_token: String(freshToken) }).catch(() => {});
      }
    });

    return () => {
      tokenSub.remove();
    };
  }, [token, user]);

  // Tap handlers: warm tap + cold start.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const route = (url: string) => {
      try {
        if (url.startsWith("http")) {
          Linking.openURL(url);
        } else {
          router.push(url as any);
        }
      } catch {
        /* noop */
      }
    };

    const tapSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const notifId = response.notification.request.identifier;
      if (notifId) {
        const key = `handled_notif_${notifId}`;
        const alreadyHandled = await AsyncStorage.getItem(key);
        if (alreadyHandled) {
          return; // Ignore duplicate tap events from cached OS intents
        }
        await AsyncStorage.setItem(key, "1");
      }

      const data = (response.notification.request.content.data || {}) as Record<string, any>;
      // Only navigate when the notification carries an explicit deep-link target.
      // If no URL is present (e.g. a stale cold-start event with no payload), do
      // nothing and let useAuthRouting send the user to their normal dashboard.
      const url = data.deeplink || data.action_url;
      if (url) {
        route(String(url));
      }
    });



    const recvSub = Notifications.addNotificationReceivedListener((notification) => {
      DeviceEventEmitter.emit(REALTIME_EVENT, {
        type: "new_notification",
        notification: notification.request.content,
      });
    });

    return () => {
      tapSub.remove();
      recvSub.remove();
    };
  }, [router]);

  return null;
}

function RealtimeBridge() {
  useRealtimeSync();
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <PushBridge />
          <RealtimeBridge />
          <RoutingShell />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
