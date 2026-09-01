import { useEffect, useRef, useState } from "react";
import { AppState, DeviceEventEmitter, Platform } from "react-native";
import { useAuth } from "@/src/auth/AuthContext";

function getWsBaseUrl(): string {
  let rawUrl = (process.env.EXPO_PUBLIC_BACKEND_URL || "").trim();
  if (!rawUrl || rawUrl.includes("trycloudflare.com")) {
    rawUrl = "https://messmate1-backend.onrender.com";
  }
  rawUrl = rawUrl.replace(/\/api\/?$/i, "").replace(/\/+$/, "");

  if (__DEV__ && Platform.OS === "android") {
    if (rawUrl.includes("localhost")) {
      rawUrl = rawUrl.replace("localhost", "10.0.2.2");
    } else if (rawUrl.includes("127.0.0.1")) {
      rawUrl = rawUrl.replace("127.0.0.1", "10.0.2.2");
    }
  }

  return rawUrl.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
}

let WS_BASE_URL = getWsBaseUrl();

export const REALTIME_EVENT = "REALTIME_EVENT";

export function useRealtimeSync() {
  const { token, user } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<any>(null);

  useEffect(() => {
    if (!token || !user) {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const connect = () => {
      if (ws.current?.readyState === WebSocket.OPEN) return;

      const wsUrl = `${WS_BASE_URL}/api/ws?token=${token}`;
      console.log("[WS] Connecting to", wsUrl);
      
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      let pingInterval: any;

      socket.onopen = () => {
        console.log("[WS] Connected successfully");
        reconnectAttempts.current = 0; // reset
        
        // Send a ping every 30 seconds to keep the connection alive behind proxies
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send("ping");
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Ignore pong responses
          if (data.type === "pong") return;
          console.log("[WS] Message received:", data);
          DeviceEventEmitter.emit(REALTIME_EVENT, data);
        } catch (e) {
          console.error("[WS] Error parsing message:", e);
        }
      };

      socket.onclose = (event) => {
        if (pingInterval) clearInterval(pingInterval);
        console.log("[WS] Disconnected:", event.code, event.reason);
        ws.current = null;
        if (isSubscribed && event.code !== 1008) { // 1008 is policy violation (e.g. bad token)
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`[WS] Reconnecting in ${delay}ms...`);
          reconnectAttempts.current += 1;
          reconnectTimeout.current = setTimeout(connect, delay);
        }
      };

      socket.onerror = (error) => {
        console.error("[WS] Error:", error);
      };
    };

    connect();

    const appStateSub = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
          console.log("[WS] App became active, attempting reconnect...");
          connect();
        }
      }
    });

    return () => {
      isSubscribed = false;
      appStateSub.remove();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [token, user]);
}
