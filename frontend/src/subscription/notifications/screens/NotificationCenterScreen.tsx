import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, View, Text, SafeAreaView, FlatList, ActivityIndicator, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { radius, spacing, typography, useTheme, shadow } from "@/src/theme";
import { Segmented } from "@/src/components/Segmented";
import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { nowIST, formatTimeFromPicker, formatISOasDateTimeIST, formatISOasDateIST } from "@/src/utils/istDate";

type AdminReceivedNotification = {
  id: string;
  institution_or_hostel_name?: string;
  category: string;
  title: string;
  description: string;
  created_at: string;
  read_status: boolean;
  action_url?: string;
  status?: string;
  date?: string;
  time?: string;
};

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function NotificationCenterScreen() {
  const { token } = useAuth();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [tab, setTab] = useState<"Received" | "Push Centre">("Received");
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" | "info" } | null>(null);

  // Received State
  const [notifications, setNotifications] = useState<AdminReceivedNotification[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(true);

  // Push Centre Form State
  const [pushTitle, setPushTitle] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"Immediate" | "Scheduled">("Immediate");
  const [pushLoading, setPushLoading] = useState(false);
  
  // Scheduling State
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [scheduledTime, setScheduledTime] = useState<Date>(nowIST());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [repeatOption, setRepeatOption] = useState<"Send Once" | "Repeat Weekly" | "Repeat Every Selected Day">("Send Once");
  
  // Manage Schedules State
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const fetchReceived = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingReceived(true);
      const data = await api.adminNotifications(token);
      setNotifications(data.items || []);
    } catch (error) {
      console.warn("Failed to fetch notifications", error);
    } finally {
      setLoadingReceived(false);
    }
  }, [token]);

  const fetchSchedules = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingSchedules(true);
      const data = await api.adminPushScheduleList(token);
      setSchedules(data.items || []);
    } catch (e) {
      console.warn("Failed to fetch schedules", e);
    } finally {
      setLoadingSchedules(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (tab === "Received") {
        fetchReceived();
      } else {
        fetchSchedules();
      }
    }, [tab, fetchReceived, fetchSchedules])
  );

  const handleNotificationPress = async (notification: AdminReceivedNotification) => {
    if (!notification.read_status && token) {
      setNotifications((prev) => 
        prev.map((n) => n.id === notification.id ? { ...n, read_status: true } : n)
      );
      try {
        await api.markAdminNotifRead(token, notification.id);
      } catch (e) {
        console.warn("Failed to mark read", e);
      }
    }

    if (notification.action_url) {
      router.push(notification.action_url as any);
    } else {
      if (["SUBSCRIPTION", "TRIAL", "CAPACITY", "PAYMENT"].includes(notification.category)) {
        router.push("/(admin)/subscription" as any);
      }
    }
  };

  const handleClearAll = async () => {
    if (!token) return;
    Alert.alert("Clear all notifications", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: async () => {
        try {
          await api.clearAdminNotifs(token);
          setNotifications([]);
          setToast({ message: "Cleared all notifications", variant: "success" });
        } catch (e) {
          setToast({ message: "Failed to clear", variant: "error" });
        }
      }}
    ]);
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const toggleAllDays = () => {
    if (selectedDays.length === 7) {
      setSelectedDays([]);
    } else {
      setSelectedDays([...DAYS_OF_WEEK]);
    }
  };

  const handleSendPush = async () => {
    if (!pushTitle.trim() || !pushMessage.trim()) {
      setToast({ message: "Title and message are required", variant: "error" });
      return;
    }
    if (scheduleMode === "Scheduled" && selectedDays.length === 0 && repeatOption !== "Send Once") {
      setToast({ message: "Please select at least one day", variant: "error" });
      return;
    }
    if (!token) return;

    setPushLoading(true);
    try {
      if (scheduleMode === "Immediate") {
        const res = await api.adminPushImmediate(token, {
          title: pushTitle.trim(),
          message: pushMessage.trim()
        });
        setToast({ message: `Sent immediately to ${res.delivered_count} students`, variant: "success" });
      } else {
        const hh = scheduledTime.getHours().toString().padStart(2, '0');
        const mm = scheduledTime.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hh}:${mm}`;

        const payload = {
          title: pushTitle.trim(),
          message: pushMessage.trim(),
          notificationType: "Scheduled" as const,
          daysSelection: selectedDays,
          scheduledTime: timeStr,
          repeatOption: repeatOption
        };

        if (editingScheduleId) {
          await api.adminPushScheduleUpdate(token, editingScheduleId, payload);
          setToast({ message: "Notification schedule updated successfully.", variant: "success" });
          setEditingScheduleId(null);
        } else {
          await api.adminPushSchedule(token, payload);
          setToast({ message: "Notification schedule saved successfully.", variant: "success" });
        }
        
        fetchSchedules();
      }
      
      if (!editingScheduleId) {
        setPushTitle("");
        setPushMessage("");
        setSelectedDays([]);
        setRepeatOption("Send Once");
      }
    } catch (e) {
      console.warn("Push failed", e);
      setToast({ message: "Failed to send/schedule push", variant: "error" });
    } finally {
      setPushLoading(false);
    }
  };

  const handleEditSchedule = (s: any) => {
    setEditingScheduleId(s.id);
    setPushTitle(s.title);
    setPushMessage(s.message);
    setScheduleMode("Scheduled");
    setSelectedDays(s.daysSelection || []);
    setRepeatOption(s.repeatOption || "Send Once");
    
    if (s.scheduledTime) {
      const [h, m] = s.scheduledTime.split(":");
      const d = nowIST();
      d.setHours(parseInt(h, 10));
      d.setMinutes(parseInt(m, 10));
      d.setSeconds(0);
      setScheduledTime(d);
    }
    
    setToast({ message: "Editing schedule. See composer above.", variant: "info" });
  };

  const cancelEdit = () => {
    setEditingScheduleId(null);
    setPushTitle("");
    setPushMessage("");
    setSelectedDays([]);
    setRepeatOption("Send Once");
  };

  const handlePauseResumeSchedule = async (s: any) => {
    if (!token) return;
    try {
      await api.adminPushScheduleUpdate(token, s.id, { ...s, isActive: !s.isActive });
      setToast({ message: `Schedule ${s.isActive ? "paused" : "resumed"}`, variant: "success" });
      fetchSchedules();
    } catch (e) {
      setToast({ message: "Failed to update schedule status", variant: "error" });
    }
  };

  const handleDeleteSchedule = async (s: any) => {
    if (!token) return;
    Alert.alert("Delete Schedule", "Are you sure you want to delete this schedule?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.adminPushScheduleDelete(token, s.id);
          setToast({ message: "Schedule deleted", variant: "success" });
          if (editingScheduleId === s.id) {
            cancelEdit();
          }
          fetchSchedules();
        } catch (e) {
          setToast({ message: "Failed to delete schedule", variant: "error" });
        }
      }}
    ]);
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

  const renderReceivedItem = ({ item }: { item: AdminReceivedNotification }) => {
    const isUnread = !item.read_status;
    const isPush = item.category === "PUSH" || item.category === "PUSH_SCHEDULED";
    return (
      <TouchableOpacity 
        style={[styles.card, isUnread && styles.unreadCard]} 
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.iconContainer}>
          {renderIcon(item.category)}
        </View>
        <View style={styles.contentContainer}>
          <Text style={[styles.title, isUnread && styles.unreadText]}>{item.title || "No Title"}</Text>
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            {item.date && item.time ? (
              <Text style={styles.date}>{item.date} • {item.time}</Text>
            ) : (
              <Text style={styles.date}>{formatISOasDateTimeIST(item.created_at)}</Text>
            )}
            {item.status && (
              <Text style={[
                styles.date, 
                { 
                  color: item.status === "Sent Successfully" ? c.success : 
                         item.status === "Failed" ? c.danger : c.primary,
                  fontWeight: "bold"
                }
              ]}>{item.status}</Text>
            )}
          </View>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {tab === "Received" && notifications.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.tabContainer}>
        <Segmented
          options={[
            { label: "Received", value: "Received" },
            { label: "Push Centre", value: "Push Centre" }
          ]}
          value={tab}
          onChange={(opt) => setTab(opt as any)}
        />
      </View>

      {tab === "Received" ? (
        loadingReceived ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(i) => i.id}
            renderItem={renderReceivedItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="bell-off" size={48} color={c.border} />
                <Text style={styles.emptyText}>No notifications</Text>
              </View>
            }
          />
        )
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.pushForm}>
            
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.pushHeader}>{editingScheduleId ? "Edit Schedule" : "Broadcast to Students"}</Text>
                  <Text style={styles.pushSub}>{editingScheduleId ? "Update your scheduled notification." : "Send an immediate or scheduled push notification to all students in your institution."}</Text>
                </View>
                {editingScheduleId && (
                  <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={pushTitle}
                  onChangeText={setPushTitle}
                  placeholder="e.g. Tomorrow Breakfast Menu"
                  placeholderTextColor={c.textTertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={pushMessage}
                  onChangeText={setPushMessage}
                  placeholder="What do you want to tell them?"
                  placeholderTextColor={c.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Delivery Method</Text>
                <View style={styles.segmentWrapper}>
                  <Segmented
                    options={[
                      { label: "Send Immediately", value: "Immediate" },
                      { label: "Schedule Notification", value: "Scheduled" }
                    ]}
                    value={scheduleMode}
                    onChange={(m) => setScheduleMode(m as any)}
                  />
                </View>
              </View>

              {scheduleMode === "Scheduled" && (
                <View style={styles.scheduleBlock}>
                  
                  {/* Days Selection */}
                  <View style={styles.inputGroup}>
                    <View style={styles.daysHeader}>
                      <Text style={styles.label}>Select Day(s)</Text>
                      <TouchableOpacity onPress={toggleAllDays}>
                        <Text style={styles.linkText}>{selectedDays.length === 7 ? "Deselect All" : "Select All"}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.daysGrid}>
                      {DAYS_OF_WEEK.map(day => {
                        const isSelected = selectedDays.includes(day);
                        return (
                          <TouchableOpacity 
                            key={day} 
                            style={[styles.dayChip, isSelected && { backgroundColor: c.primary, borderColor: c.primary }]}
                            onPress={() => toggleDay(day)}
                          >
                            <Text style={[styles.dayText, isSelected && { color: "#FFF" }]}>{day.substring(0, 3)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Time Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Delivery Time</Text>
                    <TouchableOpacity 
                      style={styles.timeSelectBtn}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Feather name="clock" size={20} color={c.textSecondary} />
                      <Text style={styles.timeSelectText}>
                        {formatTimeFromPicker(scheduledTime)}
                      </Text>
                    </TouchableOpacity>
                    {showTimePicker && (
                      <DateTimePicker
                        value={scheduledTime}
                        mode="time"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowTimePicker(Platform.OS === 'ios');
                          if (selectedDate) setScheduledTime(selectedDate);
                        }}
                      />
                    )}
                  </View>

                  {/* Repeat Options */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Schedule Option</Text>
                    <View style={styles.segmentWrapper}>
                      <Segmented
                        options={[
                          { label: "Send Once", value: "Send Once" },
                          { label: "Repeat Weekly", value: "Repeat Weekly" },
                          { label: "Repeat Daily", value: "Repeat Every Selected Day" }
                        ]}
                        value={repeatOption}
                        onChange={(m) => setRepeatOption(m as any)}
                      />
                    </View>
                  </View>
                </View>
              )}

              <Button
                label={scheduleMode === "Immediate" ? "Send Now" : (editingScheduleId ? "Update Schedule" : "Save Schedule")}
                onPress={handleSendPush}
                loading={pushLoading}
                style={{ marginTop: spacing.md }}
              />
            </View>

            {/* Manage Schedules Section */}
            <View style={styles.divider} />
            
            <View style={styles.section}>
              <Text style={styles.pushHeader}>Manage Schedules</Text>
              
              {loadingSchedules ? (
                <ActivityIndicator color={c.primary} style={{ marginTop: spacing.lg }} />
              ) : schedules.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="calendar" size={32} color={c.border} />
                  <Text style={styles.emptyText}>No active schedules.</Text>
                </View>
              ) : (
                schedules.map(s => (
                  <View key={s.id} style={[styles.scheduleCard, !s.isActive && { opacity: 0.7 }]}>
                    <View style={styles.scheduleHeader}>
                      <Text style={styles.scheduleTitle}>{s.title}</Text>
                      <View style={[styles.statusBadge, s.isActive ? styles.statusActive : styles.statusPaused]}>
                        <Text style={[styles.statusText, s.isActive ? styles.statusActiveText : styles.statusPausedText]}>
                          {s.isActive ? "Active" : "Paused"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.scheduleMessage} numberOfLines={2}>{s.message}</Text>
                    
                    <View style={styles.scheduleMeta}>
                      <View style={styles.metaItem}>
                        <Feather name="clock" size={14} color={c.textTertiary} />
                        <Text style={styles.metaText}>{s.scheduledTime}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Feather name="calendar" size={14} color={c.textTertiary} />
                        <Text style={styles.metaText}>{s.repeatOption === "Repeat Every Selected Day" ? "Selected Days" : s.repeatOption}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.scheduleDaysRow}>
                      {(s.daysSelection || []).map((d: string) => (
                        <View key={d} style={styles.miniDayChip}>
                          <Text style={styles.miniDayText}>{d.substring(0, 3)}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.scheduleActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditSchedule(s)}>
                        <Feather name="edit-2" size={16} color={c.primary} />
                        <Text style={[styles.actionText, { color: c.primary }]}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handlePauseResumeSchedule(s)}>
                        <Feather name={s.isActive ? "pause" : "play"} size={16} color={c.warning} />
                        <Text style={[styles.actionText, { color: c.warning }]}>{s.isActive ? "Pause" : "Resume"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteSchedule(s)}>
                        <Feather name="trash-2" size={16} color={c.danger} />
                        <Text style={[styles.actionText, { color: c.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      )}
      
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onHide={() => setToast(null)}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
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
  headerTitle: {
    fontSize: typography.title1.fontSize,
    fontWeight: typography.title1.fontWeight as any,
    color: c.textPrimary,
  },
  clearBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  clearText: {
    color: c.primary,
    fontWeight: "600",
  },
  tabContainer: {
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
  },
  card: {
    flexDirection: "row",
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
    alignItems: "center",
  },
  unreadCard: {
    backgroundColor: c.inputBg,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: c.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    color: c.textSecondary,
    fontWeight: "500",
    marginBottom: 4,
  },
  unreadText: {
    color: c.textPrimary,
    fontWeight: "700",
  },
  description: {
    fontSize: 14,
    color: c.textSecondary,
    marginBottom: 8,
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
    marginLeft: spacing.sm,
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
  pushForm: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 3,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cancelBtn: {
    backgroundColor: c.inputBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  cancelBtnText: {
    color: c.textSecondary,
    fontWeight: "600",
  },
  pushHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 4,
  },
  pushSub: {
    fontSize: 14,
    color: c.textSecondary,
    marginBottom: spacing.xl,
    paddingRight: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: c.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: c.inputBg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: c.textPrimary,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  segmentWrapper: {
    marginTop: spacing.xs,
  },
  scheduleBlock: {
    backgroundColor: c.card,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.md,
  },
  daysHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  linkText: {
    color: c.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.inputBg,
  },
  dayText: {
    color: c.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  timeSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.inputBg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  timeSelectText: {
    fontSize: 16,
    color: c.textPrimary,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: c.border,
    marginVertical: spacing.lg,
  },
  scheduleCard: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    ...shadow.card,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: c.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  statusActive: {
    backgroundColor: c.success + "20",
  },
  statusPaused: {
    backgroundColor: c.warning + "20",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusActiveText: {
    color: c.success,
  },
  statusPausedText: {
    color: c.warning,
  },
  scheduleMessage: {
    fontSize: 14,
    color: c.textSecondary,
    marginBottom: spacing.sm,
  },
  scheduleMeta: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: c.textTertiary,
  },
  scheduleDaysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: spacing.md,
  },
  miniDayChip: {
    backgroundColor: c.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  miniDayText: {
    fontSize: 11,
    color: c.textSecondary,
    fontWeight: "500",
  },
  scheduleActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
  }
});
