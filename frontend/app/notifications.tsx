// Notifications screen — shared between roles.
// - Students see notifications for their hostel. They can filter by All/Unread and delete them.
// - Admins can compose a one-off notification or send a menu reminder.

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  DateTimePicker = require("@react-native-community/datetimepicker").default;
}

import { api, type RecurringNotification } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { radius, shadow, spacing, typography, useTheme } from "@/src/theme";

type Item = {
  id: string;
  title: string;
  body: string;
  type: string;
  scheduled_for: string;
  send_at?: string | null;
  sent?: boolean;
  sent_at?: string | null;
  created_at: string;
  read?: boolean;
};

type ToastState = { message: string; variant: "success" | "error" | "info" } | null;

const DEFAULT_TITLE_FALLBACK = "Help reduce food waste — mark your meals";
const DEFAULT_BODY_FALLBACK =
  "Hi! Please open MessMate and mark whether you'll be eating today's meals and pick the items you'd like. This helps the mess cook the right quantity and cut down on food waste. It only takes a few seconds — thank you for participating!";

function nowPlus(minutes: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function formatDateTime(d: Date): string {
  try {
    return d.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

function formatScheduledLabel(item: Item): string {
  if (item.send_at) {
    try {
      return `For ${new Date(item.send_at).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })}`;
    } catch {
      /* noop */
    }
  }
  return `For ${item.scheduled_for}`;
}

export default function Notifications() {
  const { c } = useTheme();
  const { token, user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<Item[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  // Student specific filters
  const [filter, setFilter] = useState<"all" | "unread" | "today" | "this_week">("all");

  // Admin specific composer
  const [composer, setComposer] = useState(false);
  const [title, setTitle] = useState(DEFAULT_TITLE_FALLBACK);
  const [body, setBody] = useState(DEFAULT_BODY_FALLBACK);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState<Date>(() => nowPlus(60));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      if (isAdmin) {
        const [res, recRes] = await Promise.all([
          api.adminNotifications(token),
          api.adminListScheduledNotifications(token),
        ]);
        setItems(res.items as Item[]);
        setRecurringItems(recRes.items);
      } else {
        const res = await api.studentNotifications(token);
        setItems(res.items as Item[]);
      }
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to load", variant: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    (async () => {
      try {
        const t = await api.adminNotificationDefaultTemplate(token);
        setTitle(t.title);
        setBody(t.body);
      } catch {
        /* keep fallback */
      }
    })();
  }, [token, isAdmin]);

  const markRead = async (id: string) => {
    if (!token || isAdmin) return;
    try {
      await api.markNotifRead(token, id);
      setItems((arr) => arr.map((i) => (i.id === id ? { ...i, read: true } : i)));
    } catch {
      /* silent */
    }
  };

  const deleteStudentNotif = async (id: string) => {
    if (!token || isAdmin) return;
    Alert.alert("Delete", "Are you sure you want to remove this notification?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteStudentNotif(token, id);
            setItems((arr) => arr.filter((i) => i.id !== id));
            setToast({ message: "Notification deleted", variant: "success" });
          } catch (e: any) {
            setToast({ message: e?.message || "Could not delete", variant: "error" });
          }
        },
      },
    ]);
  };

  const toggleRecurringActive = async (item: RecurringNotification) => {
    if (!token) return;
    try {
      const res = await api.adminUpdateScheduledNotification(token, item.id, {
        isActive: !item.isActive,
      });
      setRecurringItems((prev) => prev.map((i) => (i.id === item.id ? res : i)));
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to update status", variant: "error" });
    }
  };

  const deleteRecurringItem = (id: string) => {
    Alert.alert("Delete", "Are you sure you want to delete this schedule?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            await api.adminDeleteScheduledNotification(token, id);
            setRecurringItems((prev) => prev.filter((i) => i.id !== id));
            setToast({ message: "Schedule deleted", variant: "success" });
          } catch (e: any) {
            setToast({ message: e?.message || "Failed to delete", variant: "error" });
          }
        },
      },
    ]);
  };

  const sendMenuReminder = async () => {
    if (!token) return;
    setSending(true);
    try {
      await api.adminMenuReminder(token);
      setToast({ message: "Tomorrow's menu reminder sent", variant: "success" });
      await load();
    } catch (e: any) {
      setToast({ message: e?.message || "Could not send", variant: "error" });
    } finally {
      setSending(false);
    }
  };

  const sendAnnouncement = async () => {
    if (!token || !title.trim() || !body.trim()) {
      setToast({ message: "Title and message required", variant: "info" });
      return;
    }
    if (scheduleMode === "later") {
      if (sendAt.getTime() <= Date.now() + 15_000) {
        setToast({
          message: "Please pick a time at least a minute in the future",
          variant: "info",
        });
        return;
      }
    }
    setSending(true);
    try {
      if (editingId) {
        const patch: any = { title: title.trim(), body: body.trim() };
        if (scheduleMode === "later") patch.send_at = sendAt.toISOString();
        await api.adminUpdateNotification(token, editingId, patch);
        setToast({ message: "Scheduled notification updated", variant: "success" });
      } else {
        const payload: any = {
          title: title.trim(),
          body: body.trim(),
          audience: "all",
          type: "announcement",
        };
        if (scheduleMode === "later") payload.send_at = sendAt.toISOString();
        await api.adminCreateNotification(token, payload);
        setToast({
          message: scheduleMode === "later" ? `Scheduled for ${formatDateTime(sendAt)}` : "Announcement sent",
          variant: "success",
        });
      }
      resetComposerState();
      setComposer(false);
      await load();
    } catch (e: any) {
      setToast({ message: e?.message || "Could not send", variant: "error" });
    } finally {
      setSending(false);
    }
  };

  const resetComposerState = useCallback(() => {
    setEditingId(null);
    setScheduleMode("now");
    setSendAt(nowPlus(60));
  }, []);

  const startEditScheduled = (item: Item) => {
    if (!isAdmin) return;
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setScheduleMode("later");
    if (item.send_at) {
      const d = new Date(item.send_at);
      setSendAt(d.getTime() > Date.now() + 60_000 ? d : nowPlus(60));
    } else {
      setSendAt(nowPlus(60));
    }
    setComposer(true);
  };

  const confirmCancelScheduled = (item: Item) => {
    Alert.alert("Cancel scheduled notification?", `"${item.title}" won't be sent. This can't be undone.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel it",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            await api.adminDeleteNotification(token, item.id);
            setItems((arr) => arr.filter((i) => i.id !== item.id));
            setToast({ message: "Scheduled notification cancelled", variant: "success" });
            if (editingId === item.id) {
              resetComposerState();
              setComposer(false);
            }
          } catch (e: any) {
            setToast({ message: e?.message || "Could not cancel", variant: "error" });
          }
        },
      },
    ]);
  };

  const resetToDefault = async () => {
    if (!token) return;
    try {
      const t = await api.adminNotificationDefaultTemplate(token);
      setTitle(t.title);
      setBody(t.body);
      setToast({ message: "Restored default text", variant: "info" });
    } catch {
      setTitle(DEFAULT_TITLE_FALLBACK);
      setBody(DEFAULT_BODY_FALLBACK);
    }
  };

  const scheduleSummary = useMemo(() => formatDateTime(sendAt), [sendAt]);
  const composerIsClean = useMemo(
    () => title.trim() === DEFAULT_TITLE_FALLBACK && body.trim() === DEFAULT_BODY_FALLBACK,
    [title, body]
  );

  const filteredItems = useMemo(() => {
    if (isAdmin) return items;
    const now = new Date();
    return items.filter((item) => {
      if (filter === "unread") return !item.read;
      if (filter === "today") {
        const itemDate = new Date(item.created_at);
        return itemDate.toDateString() === now.toDateString();
      }
      if (filter === "this_week") {
        const itemDate = new Date(item.created_at);
        const diff = now.getTime() - itemDate.getTime();
        return diff <= 7 * 24 * 60 * 60 * 1000;
      }
      return true;
    });
  }, [items, filter, isAdmin]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <Toast
        testID="notif-toast"
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onHide={() => setToast(null)}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.textPrimary }]}>Notifications</Text>
          <TouchableOpacity
            testID="notif-close"
            onPress={() => router.back()}
            style={[styles.closeBtn, { backgroundColor: c.inputBg }]}
          >
            <Feather name="x" size={18} color={c.textPrimary} />
          </TouchableOpacity>
        </View>

        {!isAdmin && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
            {(["all", "unread", "today", "this_week"] as const).map((f) => {
              const active = filter === f;
              const label = f === "all" ? "All" : f === "unread" ? "Unread" : f === "today" ? "Today" : "This Week";
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, { backgroundColor: active ? c.primary : c.inputBg }]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterChipText, { color: active ? "#fff" : c.textSecondary }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} />
          }
        >
          {isAdmin ? (
            <>
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, marginBottom: spacing.lg }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Daily Notification Scheduler</Text>
                    <Text style={[styles.cardHelp, { color: c.textSecondary }]}>
                      Manage automated recurring notifications that send every day.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push("/daily-scheduler/scheduler" as any)}
                    style={{ backgroundColor: c.primary, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
                  >
                    <Feather name="plus" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {recurringItems.length === 0 ? (
                  <Text style={[styles.empty, { color: c.textSecondary, marginTop: 16 }]}>
                    No scheduled notifications yet.
                  </Text>
                ) : (
                  <View style={{ marginTop: 16 }}>
                    {recurringItems.map((item) => (
                      <View key={item.id} style={[styles.recurringCard, { backgroundColor: c.bg, borderColor: c.border }]}>
                        <View style={styles.recurringHeader}>
                          <Text style={[styles.recurringTitle, { color: c.textPrimary }]}>{item.title}</Text>
                          <TouchableOpacity
                            onPress={() => toggleRecurringActive(item)}
                            style={[
                              styles.recurringBadge,
                              { backgroundColor: item.isActive ? c.success + "22" : c.textTertiary + "22" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.recurringBadgeText,
                                { color: item.isActive ? c.success : c.textTertiary },
                              ]}
                            >
                              {item.isActive ? "Active" : "Paused"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.recurringMessage, { color: c.textTertiary }]} numberOfLines={2}>
                          {item.message}
                        </Text>
                        <View style={styles.recurringDetailsRow}>
                          <View style={styles.recurringDetail}>
                            <Feather name="clock" size={14} color={c.textTertiary} />
                            <Text style={[styles.recurringDetailText, { color: c.textTertiary }]}>
                              {item.scheduledTime} ({item.notificationType})
                            </Text>
                          </View>
                          <View style={styles.recurringDetail}>
                            <Feather name="calendar" size={14} color={c.textTertiary} />
                            <Text style={[styles.recurringDetailText, { color: c.textTertiary }]}>
                              {item.startDate} {item.endDate ? `to ${item.endDate}` : "onwards"}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.recurringActions, { borderTopColor: c.divider }]}>
                          <TouchableOpacity style={styles.recurringActionBtn} onPress={() => deleteRecurringItem(item.id)}>
                            <Feather name="trash-2" size={16} color={c.danger} />
                            <Text style={[styles.recurringActionText, { color: c.danger }]}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Send one-off notification</Text>
              <Text style={[styles.cardHelp, { color: c.textSecondary }]}>
                Broadcasts to every student in your hostel.
              </Text>
              <Button
                testID="notif-menu-reminder"
                label={sending ? "Sending..." : "Send tomorrow's menu reminder"}
                onPress={sendMenuReminder}
                loading={sending}
                style={{ marginTop: 12 }}
              />
              <TouchableOpacity
                testID="notif-toggle-composer"
                onPress={() => {
                  setComposer((v) => {
                    const next = !v;
                    if (!next) resetComposerState();
                    return next;
                  });
                }}
                style={[styles.linkRow, { borderTopColor: c.divider }]}
              >
                <Feather name={composer ? "chevron-up" : "edit-3"} size={16} color={c.primary} />
                <Text style={[styles.linkText, { color: c.primary }]}>
                  {composer ? (editingId ? "Cancel editing" : "Hide composer") : "Compose a reminder to reduce food waste"}
                </Text>
              </TouchableOpacity>

              {composer ? (
                <View style={{ marginTop: 12 }}>
                  <View style={styles.composerLabelRow}>
                    <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Title</Text>
                    {!composerIsClean ? (
                      <TouchableOpacity onPress={resetToDefault}>
                        <Text style={[styles.resetLink, { color: c.primary }]}>Reset to default</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <TextInput
                    testID="notif-title-input"
                    placeholder="Notification title"
                    placeholderTextColor={c.textSecondary}
                    value={title}
                    onChangeText={setTitle}
                    style={[styles.input, { backgroundColor: c.inputBg, color: c.textPrimary }]}
                  />
                  <Text style={[styles.fieldLabel, { color: c.textSecondary, marginTop: 12 }]}>Message</Text>
                  <TextInput
                    testID="notif-body-input"
                    placeholder="Message"
                    placeholderTextColor={c.textSecondary}
                    value={body}
                    onChangeText={setBody}
                    multiline
                    style={[styles.input, { backgroundColor: c.inputBg, color: c.textPrimary, minHeight: 110, textAlignVertical: "top" }]}
                  />
                  <Text style={[styles.fieldLabel, { color: c.textSecondary, marginTop: 16 }]}>Delivery</Text>
                  <View style={styles.segment}>
                    {(["now", "later"] as const).map((opt) => {
                      const active = scheduleMode === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          testID={`notif-schedule-${opt}`}
                          activeOpacity={0.85}
                          onPress={() => setScheduleMode(opt)}
                          style={[styles.segmentBtn, { backgroundColor: active ? c.card : "transparent", borderColor: active ? c.primary : "transparent" }]}
                        >
                          <Feather name={opt === "now" ? "send" : "clock"} size={14} color={active ? c.primary : c.textSecondary} />
                          <Text style={[styles.segmentLabel, { color: active ? c.textPrimary : c.textSecondary }]}>
                            {opt === "now" ? "Send now" : "Schedule for later"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {scheduleMode === "later" ? (
                    <View style={styles.schedulePickerRow}>
                      <TouchableOpacity
                        testID="notif-pick-date"
                        onPress={() => setShowDatePicker(true)}
                        style={[styles.pickerBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
                      >
                        <Feather name="calendar" size={14} color={c.primary} />
                        <Text style={[styles.pickerText, { color: c.textPrimary }]}>
                          {sendAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID="notif-pick-time"
                        onPress={() => setShowTimePicker(true)}
                        style={[styles.pickerBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
                      >
                        <Feather name="clock" size={14} color={c.primary} />
                        <Text style={[styles.pickerText, { color: c.textPrimary }]}>
                          {sendAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {showDatePicker ? (
                    Platform.OS === "web" ? (
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={sendAt.toISOString().split("T")[0]}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            setSendAt((prev) => {
                              const [y, m, d] = val.split("-");
                              const next = new Date(prev);
                              next.setFullYear(Number(y), Number(m) - 1, Number(d));
                              return next;
                            });
                          }
                          setShowDatePicker(false);
                        }}
                        style={{ marginTop: 10, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
                      />
                    ) : (
                      <DateTimePicker
                        testID="notif-date-picker"
                        value={sendAt}
                        mode="date"
                        minimumDate={new Date()}
                        onChange={(e: any, d?: Date) => { setShowDatePicker(false); if (d && e.type !== "dismissed") setSendAt((prev) => { const next = new Date(prev); next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); return next; }); }}
                      />
                    )
                  ) : null}
                  {showTimePicker ? (
                    Platform.OS === "web" ? (
                      <input
                        type="time"
                        value={sendAt.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            setSendAt((prev) => {
                              const [h, m] = val.split(":");
                              const next = new Date(prev);
                              next.setHours(Number(h), Number(m), 0, 0);
                              return next;
                            });
                          }
                          setShowTimePicker(false);
                        }}
                        style={{ marginTop: 10, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
                      />
                    ) : (
                      <DateTimePicker
                        testID="notif-time-picker"
                        value={sendAt}
                        mode="time"
                        is24Hour={false}
                        onChange={(e: any, d?: Date) => { setShowTimePicker(false); if (d && e.type !== "dismissed") setSendAt((prev) => { const next = new Date(prev); next.setHours(d.getHours(), d.getMinutes(), 0, 0); return next; }); }}
                      />
                    )
                  ) : null}
                  <Button
                    testID="notif-send-announcement"
                    label={editingId ? (scheduleMode === "later" ? `Save & reschedule for ${scheduleSummary}` : "Save changes") : (scheduleMode === "later" ? `Schedule for ${scheduleSummary}` : "Send to all students now")}
                    onPress={sendAnnouncement}
                    loading={sending}
                    style={{ marginTop: 14 }}
                  />
                </View>
              ) : null}
            </View>
            </>
          ) : null}

          {loading ? (
            <View style={styles.centerWrap}><ActivityIndicator color={c.primary} /></View>
          ) : filteredItems.length === 0 ? (
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.empty, { color: c.textSecondary }]}>
                {isAdmin ? "No notifications sent yet." : "No notifications found."}
              </Text>
            </View>
          ) : (
            filteredItems.map((n) => {
              const scheduledFuture = isAdmin && n.sent === false;
              return (
                <TouchableOpacity
                  key={n.id}
                  testID={`notif-item-${n.id}`}
                  activeOpacity={isAdmin ? 1 : 0.85}
                  onPress={() => {
                    if (!isAdmin) {
                      if (!n.read) markRead(n.id);
                      router.push(`/notification/${n.id}` as any);
                    }
                  }}
                  style={[
                    styles.notifCard,
                    {
                      backgroundColor: c.card,
                      borderColor: scheduledFuture ? c.primary : c.border,
                      borderWidth: scheduledFuture ? 1.5 : 1,
                      opacity: !isAdmin && n.read ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={styles.notifRow}>
                    <View style={[styles.notifBadge, { backgroundColor: n.type === "menu_reminder" ? c.primaryTint : c.inputBg }]}>
                      <Feather
                        name={n.type === "menu_reminder" ? "calendar" : n.type === "system" ? "info" : "bell"}
                        size={16}
                        color={n.type === "menu_reminder" ? c.primary : c.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.notifTitleRow}>
                        <Text style={[styles.notifTitle, { color: c.textPrimary }]} numberOfLines={2}>
                          {n.title}
                        </Text>
                        {scheduledFuture ? (
                          <View style={[styles.pill, { backgroundColor: c.primaryTint }]}>
                            <Feather name="clock" size={10} color={c.primary} />
                            <Text style={[styles.pillText, { color: c.primary }]}>Scheduled</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.notifBody, { color: c.textSecondary }]} numberOfLines={2}>
                        {n.body}
                      </Text>
                      <Text style={[styles.notifMeta, { color: c.textTertiary }]}>
                        {formatScheduledLabel(n)}
                      </Text>
                      {scheduledFuture ? (
                        <View style={styles.actionsRow}>
                          <TouchableOpacity onPress={() => startEditScheduled(n)} style={[styles.actionBtn, { backgroundColor: c.inputBg }]}>
                            <Feather name="edit-2" size={12} color={c.textPrimary} />
                            <Text style={[styles.actionText, { color: c.textPrimary }]}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => confirmCancelScheduled(n)} style={[styles.actionBtn, { backgroundColor: c.dangerTint || "#FEE2E2" }]}>
                            <Feather name="x-circle" size={12} color={c.danger || "#DC2626"} />
                            <Text style={[styles.actionText, { color: c.danger || "#DC2626" }]}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      {!isAdmin && (
                        <View style={styles.actionsRow}>
                          <TouchableOpacity onPress={() => deleteStudentNotif(n.id)} style={[styles.actionBtn, { backgroundColor: c.inputBg }]}>
                            <Feather name="trash-2" size={12} color={c.textSecondary} />
                            <Text style={[styles.actionText, { color: c.textSecondary }]}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {!isAdmin && !n.read ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.title1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, marginBottom: spacing.md, ...shadow.card },
  cardTitle: { ...typography.title2 },
  cardHelp: { ...typography.caption, marginTop: 6, lineHeight: 18 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderTopWidth: 1, marginTop: 12 },
  linkText: { ...typography.subhead, fontWeight: "600" },
  fieldLabel: { ...typography.footnote, fontWeight: "700", letterSpacing: 0.4, marginBottom: 6, textTransform: "uppercase" },
  composerLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resetLink: { ...typography.footnote, fontWeight: "700", marginBottom: 6 },
  input: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  segment: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 12, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  segmentLabel: { ...typography.footnote, fontWeight: "700" },
  schedulePickerRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  pickerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1 },
  pickerText: { ...typography.subhead, fontWeight: "600" },
  centerWrap: { paddingVertical: 60, alignItems: "center" },
  empty: { ...typography.subhead, textAlign: "center" },
  notifCard: { borderRadius: radius.lg, padding: spacing.md, marginBottom: 10, borderWidth: 1, ...shadow.card },
  notifRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  notifBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  notifTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  notifTitle: { ...typography.headline, flexShrink: 1 },
  notifBody: { ...typography.subhead, marginTop: 4, lineHeight: 20 },
  notifMeta: { ...typography.caption, marginTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { ...typography.caption, fontWeight: "700", fontSize: 11 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  actionText: { ...typography.caption, fontWeight: "700", fontSize: 12 },
  filterScroll: { paddingHorizontal: spacing.lg, maxHeight: 40 },
  filterContent: { paddingRight: spacing.lg, gap: 8, alignItems: "center" },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill },
  filterChipText: { ...typography.subhead, fontWeight: "600" },
  recurringCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  recurringHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  recurringTitle: {
    ...typography.headline,
    flex: 1,
    marginRight: spacing.sm,
  },
  recurringBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  recurringBadgeText: {
    ...typography.caption,
    fontWeight: "600",
  },
  recurringMessage: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  recurringDetailsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  recurringDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recurringDetailText: {
    ...typography.caption,
  },
  recurringActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  recurringActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: spacing.xs,
  },
  recurringActionText: {
    ...typography.caption,
    fontWeight: "600",
  },
});
