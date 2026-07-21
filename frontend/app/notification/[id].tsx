import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { radius, shadow, spacing, typography, useTheme } from "@/src/theme";
import { formatISOasDateTimeIST } from "@/src/utils/istDate";

export default function NotificationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { token, user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotif = async () => {
      if (!token || !id) return;
      try {
        setLoading(true);
        // Using studentNotifications to find the specific one for now
        // A direct GET /api/student/notifications/{id} would be better, but we can filter the list
        const res = await api.studentNotifications(token);
        const found = res.items.find((n: any) => n.id === id);
        
        if (found) {
          setNotification(found);
          if (!found.read_status && user?.role !== "admin") {
            api.markStudentNotifRead(token, id).catch(() => {});
          }
        } else {
          setError("Notification not found");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load notification");
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotif();
  }, [token, id, user?.role]);

  const handleDelete = async () => {
    if (!token || !id) return;
    try {
      await api.deleteStudentNotif(token, id);
      router.back();
    } catch (e: any) {
      // ignore
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>Notification Details</Text>
      </View>
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color={c.danger} style={{ marginBottom: 16 }} />
          <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
        </View>
      ) : notification ? (
        <ScrollView style={styles.content}>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: c.primaryTint }]}>
                <Feather 
                  name={notification.type === "menu_reminder" ? "calendar" : "bell"} 
                  size={24} 
                  color={c.primary} 
                />
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.dateText, { color: c.textSecondary }]}>
                  {formatISOasDateTimeIST(notification.created_at)}
                </Text>
                <View style={[styles.badge, { backgroundColor: c.inputBg }]}>
                  <Text style={[styles.badgeText, { color: c.textSecondary }]}>
                    Admin
                  </Text>
                </View>
              </View>
            </View>
            
            <Text style={[styles.title, { color: c.textPrimary }]}>
              {notification.title}
            </Text>
            
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            
            <Text style={[styles.body, { color: c.textSecondary }]}>
              {notification.message}
            </Text>
            
            {user?.role !== "admin" && (
              <TouchableOpacity 
                style={[styles.deleteBtn, { borderColor: c.danger }]}
                onPress={handleDelete}
              >
                <Feather name="trash-2" size={16} color={c.danger} />
                <Text style={[styles.deleteText, { color: c.danger }]}>Delete Notification</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    marginRight: spacing.md,
  },
  headerTitle: {
    ...typography.title2,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    textAlign: "center",
  },
  content: {
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    alignItems: "flex-end",
    gap: 8,
  },
  dateText: {
    ...typography.caption,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: "600",
  },
  title: {
    ...typography.title2,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    width: "100%",
    marginVertical: spacing.lg,
  },
  body: {
    ...typography.body,
    lineHeight: 24,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.xl * 2,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  deleteText: {
    ...typography.headline,
  }
});
