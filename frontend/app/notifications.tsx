import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { radius, spacing, typography, useTheme } from "@/src/theme";
import { Toast } from "@/src/components/Toast";
import { Segmented } from "@/src/components/Segmented";
import { getDayNameIST } from "@/src/utils/istDate";

type StudentNotification = {
  id: string;
  title: string;
  message: string;
  date: string;
  day?: string;
  time: string;
  created_at: string;
  read_status: boolean;
};

export default function StudentNotificationsScreen() {
  const { token } = useAuth();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | "Unread">("All");
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" | "info" } | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await api.studentNotifications(token);
      setNotifications(data.items || []);
    } catch (error) {
      console.warn("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const handleNotificationPress = async (notification: StudentNotification) => {
    if (!notification.read_status && token) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read_status: true } : n))
      );
      try {
        await api.markStudentNotifRead(token, notification.id);
      } catch (e) {
        console.warn("Failed to mark read", e);
      }
    }
  };

  const handleDeleteOne = (notification: StudentNotification) => {
    if (!token) return;
    Alert.alert("Delete Notification", "Remove this notification from your list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
          try {
            await api.deleteStudentNotif(token, notification.id);
          } catch (e) {
            // Re-fetch if delete failed
            fetchNotifications();
          }
        },
      },
    ]);
  };

  const handleClearAll = async () => {
    if (!token) return;
    Alert.alert("Clear All Notifications", "Are you sure you want to delete all notifications?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: async () => {
          try {
            await api.clearStudentNotifs(token);
            setNotifications([]);
            setToast({ message: "Cleared all notifications", variant: "success" });
          } catch (e) {
            setToast({ message: "Failed to clear notifications", variant: "error" });
          }
        },
      },
    ]);
  };

  const getDayLabel = (item: StudentNotification): string => {
    if (item.day) return item.day;
    try {
      return getDayNameIST(new Date(item.created_at));
    } catch {
      return "";
    }
  };

  const renderItem = ({ item }: { item: StudentNotification }) => {
    const isUnread = !item.read_status;
    const dayLabel = getDayLabel(item);

    return (
      <TouchableOpacity
        testID="notification-item"
        style={[styles.card, isUnread && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.iconContainer}>
          <Feather name="bell" size={22} color={isUnread ? c.primary : c.textSecondary} />
        </View>
        <View style={styles.contentContainer}>
          {!!item.title && (
            <Text style={[styles.title, isUnread && styles.unreadText]} numberOfLines={1}>
              {item.title}
            </Text>
          )}
          <Text style={styles.description} numberOfLines={4}>{item.message}</Text>
          <Text style={styles.date}>Sender: Hostel Admin</Text>
          <Text style={styles.date}>
            {dayLabel ? `${dayLabel}, ` : ""}{item.date}  •  {item.time}
          </Text>
        </View>
        <View style={styles.rightActions}>
          {isUnread && <View style={styles.unreadDot} />}
          <TouchableOpacity
            testID="delete-notif-btn"
            onPress={() => handleDeleteOne(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.deleteBtn}
          >
            <Feather name="trash-2" size={15} color={c.textTertiary} />
            <Text style={{ fontSize: 12, color: c.textTertiary, marginLeft: 4 }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const displayedNotifs = notifications.filter((n) => filter === "All" || !n.read_status);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.rightPlaceholder}>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterContainer}>
        <Segmented
          options={[
            { label: "All", value: "All" },
            { label: "Unread", value: "Unread" },
          ]}
          value={filter}
          onChange={(opt) => setFilter(opt as any)}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={displayedNotifs}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="bell-off" size={48} color={c.border} />
              <Text style={styles.emptyText}>
                No notifications available.
              </Text>
            </View>
          }
        />
      )}

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onHide={() => setToast(null)} />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.lg,
      paddingBottom: spacing.md,
    },
    backBtn: {
      padding: spacing.xs,
    },
    headerTitle: {
      fontSize: typography.title1.fontSize,
      fontWeight: typography.title1.fontWeight as any,
      color: c.textPrimary,
    },
    rightPlaceholder: {
      minWidth: 64,
      alignItems: "flex-end",
    },
    clearText: {
      color: c.danger,
      fontWeight: "600",
      fontSize: 13,
    },
    filterContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    list: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl + 40,
    },
    card: {
      flexDirection: "row",
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
      alignItems: "flex-start",
    },
    unreadCard: {
      backgroundColor: c.inputBg,
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
      marginTop: 2,
    },
    contentContainer: {
      flex: 1,
      paddingRight: spacing.xs,
    },
    rightActions: {
      alignItems: "center",
      gap: 8,
      paddingLeft: 4,
      paddingTop: 2,
    },
    title: {
      fontSize: 15,
      color: c.textSecondary,
      fontWeight: "600",
      marginBottom: 3,
    },
    unreadText: {
      color: c.textPrimary,
      fontWeight: "700",
    },
    description: {
      fontSize: 14,
      color: c.textSecondary,
      marginBottom: 6,
      lineHeight: 20,
    },
    date: {
      fontSize: 12,
      color: c.textTertiary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
    },
    deleteBtn: {
      padding: 4,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xl * 2,
    },
    emptyText: {
      marginTop: spacing.md,
      color: c.textTertiary,
      fontSize: 16,
    },
  });

