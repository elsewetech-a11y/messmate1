import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { radius, shadow, spacing, typography, useTheme } from "@/src/theme";

export default function AdminNotificationScheduler() {
  const { token } = useAuth();
  const { c } = useTheme();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"Daily" | "Weekly" | "One Time">("Daily");

  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [startDate, setStartDate] = useState(new Date());
  const [showStartDate, setShowStartDate] = useState(false);

  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showEndDate, setShowEndDate] = useState(false);

  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const onSave = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert("Error", "Title and Message are required");
      return;
    }
    if (message.length > 1000) {
      Alert.alert("Error", "Message must be 1000 characters or less");
      return;
    }
    if (endDate && endDate < startDate) {
      Alert.alert("Error", "End Date cannot be before Start Date");
      return;
    }

    if (!token) return;
    setSaving(true);
    try {
      await api.adminCreateScheduledNotification(token, {
        title: title.trim(),
        message: message.trim(),
        notificationType: type,
        scheduledTime: `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate ? endDate.toISOString().split("T")[0] : null,
      });
      Alert.alert("Success", "Scheduled Successfully");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const renderTypeOption = (opt: "Daily" | "Weekly" | "One Time") => (
    <TouchableOpacity
      key={opt}
      style={[
        styles.typeBtn,
        { borderColor: c.border },
        type === opt && { backgroundColor: c.primary, borderColor: c.primary },
      ]}
      onPress={() => setType(opt)}
    >
      <Text style={[styles.typeText, { color: type === opt ? "#fff" : c.textPrimary }]}>{opt}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.textPrimary }]}>New Schedule</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textPrimary }]}>Notification Title</Text>
            <TextInput
              style={[styles.input, { color: c.textPrimary, borderColor: c.border, backgroundColor: c.card }]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. 🍽️ Tomorrow's Mess Preference"
              placeholderTextColor={c.textTertiary}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: c.textPrimary }]}>Message</Text>
              <Text style={[styles.charCount, { color: message.length > 1000 ? c.danger : c.textTertiary }]}>
                {message.length}/1000
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { color: c.textPrimary, borderColor: c.border, backgroundColor: c.card },
              ]}
              value={message}
              onChangeText={setMessage}
              placeholder="Your message here..."
              placeholderTextColor={c.textTertiary}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textPrimary }]}>Notification Type</Text>
            <View style={styles.typeRow}>
              {(["Daily", "Weekly", "One Time"] as const).map(renderTypeOption)}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textPrimary }]}>Time to Send</Text>
            <TouchableOpacity
              style={[styles.dateBtn, { borderColor: c.border, backgroundColor: c.card }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Feather name="clock" size={18} color={c.textPrimary} />
              <Text style={[styles.dateText, { color: c.textPrimary }]}>
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
            {showTimePicker && (
              Platform.OS === "web" ? (
                <input
                  type="time"
                  value={`${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const newDate = new Date(time);
                    newDate.setHours(parseInt(hours), parseInt(minutes));
                    setTime(newDate);
                    setShowTimePicker(false);
                  }}
                  style={{ marginTop: 10, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
                />
              ) : (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="default"
                  onChange={(event: any, date?: Date) => {
                    setShowTimePicker(false);
                    if (date) setTime(date);
                  }}
                />
              )
            )}
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
              <Text style={[styles.label, { color: c.textPrimary }]}>Start Date</Text>
              <TouchableOpacity
                style={[styles.dateBtn, { borderColor: c.border, backgroundColor: c.card }]}
                onPress={() => setShowStartDate(true)}
              >
                <Feather name="calendar" size={18} color={c.textPrimary} />
                <Text style={[styles.dateText, { color: c.textPrimary }]}>
                  {startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              {showStartDate && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event: any, date?: Date) => {
                    setShowStartDate(false);
                    if (date) setStartDate(date);
                  }}
                />
              )}
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.sm }]}>
              <Text style={[styles.label, { color: c.textPrimary }]}>End Date (Optional)</Text>
              <TouchableOpacity
                style={[styles.dateBtn, { borderColor: c.border, backgroundColor: c.card }]}
                onPress={() => setShowEndDate(true)}
              >
                <Feather name="calendar" size={18} color={c.textPrimary} />
                <Text style={[styles.dateText, { color: c.textPrimary }]}>
                  {endDate ? endDate.toLocaleDateString() : "Forever"}
                </Text>
              </TouchableOpacity>
              {showEndDate && (
                <DateTimePicker
                  value={endDate || new Date()}
                  mode="date"
                  display="default"
                  minimumDate={startDate}
                  onChange={(event: any, date?: Date) => {
                    setShowEndDate(false);
                    if (date) setEndDate(date);
                  }}
                />
              )}
              {endDate && (
                <TouchableOpacity onPress={() => setEndDate(null)}>
                  <Text style={{ color: c.danger, fontSize: 12, marginTop: 4 }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textPrimary }]}>Audience</Text>
            <Text style={[styles.helpText, { color: c.textTertiary }]}>
              Automatically sends to all students connected to your institution.
            </Text>
          </View>

          {showPreview && (
            <View style={[styles.previewCard, { backgroundColor: c.card, shadowColor: c.textPrimary }]}>
              <Text style={[styles.previewHeader, { color: c.textTertiary }]}>Push Notification Preview</Text>
              <View style={styles.previewBox}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <View style={[styles.previewAppIcon, { backgroundColor: c.primary }]} />
                  <Text style={[styles.previewAppName, { color: c.textPrimary }]}>MessMate</Text>
                  <Text style={[styles.previewTime, { color: c.textTertiary }]}>now</Text>
                </View>
                <Text style={[styles.previewTitle, { color: c.textPrimary }]}>
                  {title || "Notification Title"}
                </Text>
                <Text style={[styles.previewMessage, { color: c.textPrimary }]} numberOfLines={4}>
                  {message || "Notification message will appear here..."}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.previewBtn, { borderColor: c.primary }]}
            onPress={() => setShowPreview(!showPreview)}
          >
            <Text style={[styles.previewBtnText, { color: c.primary }]}>
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.bottomBar, { backgroundColor: c.bg, borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: c.primary }, saving && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save & Activate"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
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
  content: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    ...typography.headline,
    marginBottom: 6,
  },
  charCount: {
    ...typography.caption,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  textArea: {
    height: 120,
  },
  typeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  typeBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  typeText: {
    ...typography.body,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dateText: {
    ...typography.body,
  },
  helpText: {
    ...typography.body,
    fontSize: 14,
  },
  previewBtn: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  previewBtnText: {
    ...typography.headline,
  },
  previewCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  previewHeader: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  previewBox: {
    padding: spacing.sm,
  },
  previewAppIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 8,
  },
  previewAppName: {
    ...typography.caption,
    fontWeight: "600",
    flex: 1,
  },
  previewTime: {
    ...typography.caption,
  },
  previewTitle: {
    ...typography.body,
    fontWeight: "600",
    marginBottom: 4,
  },
  previewMessage: {
    ...typography.body,
    lineHeight: 20,
  },
  bottomBar: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  saveBtnText: {
    ...typography.headline,
    color: "#fff",
    fontSize: 16,
  },
});
