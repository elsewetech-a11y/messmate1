// Push notification helpers — Expo + Native FCM.

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/src/api/client";

/**
 * Permission → native FCM token → backend register.
 * Automatically retries up to maxAttempts if Firebase/Google Play Services is initializing.
 */
export async function registerForPush(
  authToken: string | null,
  userId: string | null,
  maxAttempts = 3,
): Promise<string | null> {
  if (!authToken || !userId) return null;
  if (Platform.OS === "web") return null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== "granted" && existing.canAskAgain !== false) {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== "granted") {
        console.log(`[Push] Notification permission not granted (status: ${status})`);
        return null;
      }

      const tokenResp = await Notifications.getDevicePushTokenAsync();
      const deviceToken = tokenResp?.data;
      if (!deviceToken) {
        throw new Error("No device push token returned from getDevicePushTokenAsync");
      }

      console.log(`[Push] Acquired native FCM token (attempt ${attempt}):`, String(deviceToken).slice(0, 20) + "...");
      const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";

      // Register and save with backend
      await Promise.allSettled([
        api.registerPush(authToken, {
          user_id: userId,
          platform,
          device_token: String(deviceToken),
        }),
        api.savePushToken(authToken, {
          push_token: String(deviceToken),
          platform,
        }),
      ]);
      return String(deviceToken);
    } catch (err: any) {
      console.warn(`[Push] Attempt ${attempt}/${maxAttempts} failed:`, err?.message || err);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  return null;
}
