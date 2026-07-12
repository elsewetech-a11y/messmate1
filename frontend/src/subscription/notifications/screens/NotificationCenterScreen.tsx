import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, View, Text, SafeAreaView, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api, type NotificationPublic } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { radius, spacing, typography, useTheme, type ThemeColors } from "@/src/theme";

export function NotificationCenterScreen() {
  const { token } = useAuth();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await api.getNotifications(token);
      setNotifications(data);
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

  const handleNotificationPress = async (notification: NotificationPublic) => {
    if (!notification.read_status && token) {
      // Optimistic update
      setNotifications((prev) => 
        prev.map((n) => n.id === notification.id ? { ...n, read_status: true } : n)
      );
      try {
        await api.markNotificationRead(token, notification.id);
      } catch (e) {
        console.warn("Failed to mark read", e);
      }
    }

    if (notification.action_url) {
      router.push(notification.action_url as any);
    } else {
      // Default fallback based on category
      if (["SUBSCRIPTION", "TRIAL", "CAPACITY"].includes(notification.category)) {
        router.push("/(admin)/subscription" as any);
      }
    }
  };

  const renderIcon = (category: string) => {
    switch (category) {
      case "TRIAL": return <Feather name="clock" size={24} color={c.primary} />;
      case "SUBSCRIPTION": return <Feather name="calendar" size={24} color={c.primary} />;
      case "PAYMENT": return <Feather name="credit-card" size={24} color={c.success} />;
      case "CAPACITY": return <Feather name="users" size={24} color={c.warning} />;
      default: return <Feather name="bell" size={24} color={c.textSecondary} />;
    }
  };

  const renderItem = ({ item }: { item: NotificationPublic }) => {
    const isUnread = !item.read_status;
    return (
      <TouchableOpacity 
        style={[styles.card, isUnread && styles.unreadCard]} 
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.iconContainer}>
          {renderIcon(item.category)}
        </View>
        <View style={styles.contentContainer}>
          <Text style={[styles.title, isUnread && styles.unreadText]}>{item.title}</Text>
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="bell-off" size={48} color={c.border} />
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { marginBottom: spacing.lg },
    headerTitle: { ...typography.title2, color: c.textPrimary },
    card: {
      flexDirection: "row",
      backgroundColor: c.card,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center"
    },
    unreadCard: {
      backgroundColor: c.primaryTint,
      borderColor: c.primaryLight,
    },
    iconContainer: {
      marginRight: spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    contentContainer: {
      flex: 1,
    },
    title: {
      ...typography.headline,
      color: c.textPrimary,
      marginBottom: 4,
    },
    unreadText: {
      fontWeight: "700",
    },
    description: {
      ...typography.subhead,
      color: c.textSecondary,
      marginBottom: 6,
    },
    date: {
      ...typography.caption,
      color: c.textTertiary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
      marginLeft: spacing.sm,
    },
    emptyBox: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
    emptyText: { ...typography.body, color: c.textSecondary, marginTop: 16 },
  });
