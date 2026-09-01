import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { radius, spacing, typography, useTheme, shadow } from "@/src/theme";
import { Segmented } from "@/src/components/Segmented";
import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { nowIST, formatTimeFromPicker } from "@/src/utils/istDate";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function NotificationCenterScreen() {
  const { token } = useAuth();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" | "info" } | null>(null);

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

  const fetchSchedules = useCallback(async (showSpinner = false) => {
    if (!token) return;
    try {
      if (showSpinner) setLoadingSchedules(true);
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
      fetchSchedules(schedules.length === 0);
    }, [fetchSchedules, schedules.length])
  );

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
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to process push notification", variant: "error" });
    } finally {
      setPushLoading(false);
    }
  };

  const handleEditSchedule = (schedule: any) => {
    setEditingScheduleId(schedule.id);
    setPushTitle(schedule.title);
    setPushMessage(schedule.message);
    setScheduleMode("Scheduled");
    setSelectedDays(schedule.daysSelection || []);
    setRepeatOption(schedule.repeatOption || "Send Once");
    
    if (schedule.scheduledTime) {
      const [hh, mm] = schedule.scheduledTime.split(':');
      const d = nowIST();
      d.setHours(parseInt(hh, 10));
      d.setMinutes(parseInt(mm, 10));
      setScheduledTime(d);
    }
  };

  const cancelEdit = () => {
    setEditingScheduleId(null);
    setPushTitle("");
    setPushMessage("");
    setSelectedDays([]);
    setRepeatOption("Send Once");
  };

  const handlePauseResumeSchedule = async (schedule: any) => {
    if (!token) return;
    try {
      await api.adminPushScheduleUpdate(token, schedule.id, { isActive: !schedule.isActive });
      setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, isActive: !s.isActive } : s));
      setToast({ message: `Schedule ${schedule.isActive ? "paused" : "resumed"}`, variant: "success" });
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to update schedule status", variant: "error" });
    }
  };

  const handleDeleteSchedule = async (schedule: any) => {
    if (!token) return;
    Alert.alert("Delete Schedule", `Are you sure you want to delete "${schedule.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          try {
            await api.adminPushScheduleDelete(token, schedule.id);
            setSchedules(prev => prev.filter(s => s.id !== schedule.id));
            setToast({ message: "Schedule deleted", variant: "success" });
          } catch (e: any) {
            setToast({ message: e?.message || "Failed to delete schedule", variant: "error" });
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Push Notification Centre</Text>
      </View>
      
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
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 32) + 16 : 16,
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
