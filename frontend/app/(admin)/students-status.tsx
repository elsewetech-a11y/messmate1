// Admin Tab 1 — Students Status.
// Approval list (pending) + meal-wise breakdown (eating/items/reasons/custom Q) + feedback.

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  api,
  type AdminTodayResponse,
  type MealStat,
  type MealType,
  type StudentRow,
  type StudentsSummary,
} from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { LikeDislikeBar } from "@/src/components/LikeDislikeBar";
import { Segmented } from "@/src/components/Segmented";
import { StatTile } from "@/src/components/StatTile";
import { Toast } from "@/src/components/Toast";
import { radius, shadow, spacing, typography, colors, useTheme, type ThemeColors } from "@/src/theme";
import { SubscriptionGuard } from "@/src/subscription/components/SubscriptionGuard";

const MEAL_ICON: Record<MealType, keyof typeof Feather.glyphMap> = {
  breakfast: "coffee",
  lunch: "sun",
  dinner: "moon",
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AdminStudentsStatus() {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { token } = useAuth();
  const [summary, setSummary] = useState<StudentsSummary | null>(null);
  const [pending, setPending] = useState<StudentRow[]>([]);
  const [today, setToday] = useState<AdminTodayResponse | null>(null);
  const [feedback, setFeedback] = useState<
    { id: string; date: string; feedback_text: string; created_at: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error" | "info";
  } | null>(null);

  // Notification Modal State
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifTitle, setNotifTitle] = useState("Tomorrow's Plan Reminder");
  const [notifBody, setNotifBody] = useState("Please open the app and submit your Tomorrow's Plan before today's deadline.");
  const [sendingNotif, setSendingNotif] = useState(false);

  const onSendNotification = async () => {
    if (!token) return;
    if (!notifTitle.trim() || !notifBody.trim()) {
      setToast({ message: "Title and message are required", variant: "error" });
      return;
    }
    setSendingNotif(true);
    try {
      await api.adminCreateNotification(token, {
        title: notifTitle.trim(),
        body: notifBody.trim(),
        audience: "student",
        action_url: "/(student)/home?day=tomorrow",
      });
      setShowNotifModal(false);
      setToast({ message: "Notification sent!", variant: "success" });
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to send notification", variant: "error" });
    } finally {
      setSendingNotif(false);
    }
  };

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, p, t, f] = await Promise.all([
        api.adminStudentsSummary(token),
        api.adminStudentsList(token, "pending"),
        api.adminToday(token),
        api.adminFeedback(token, 7),
      ]);
      setSummary(s);
      setPending(p.students);
      setToday(t);
      setFeedback(f.items);
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to load", variant: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onApprove = async (id: string) => {
    if (!token) return;
    setActing(id);
    try {
      const res = await api.adminApprove(token, id);
      if (res.status === "pending_capacity") {
        setToast({ message: "Capacity reached. Added to Pending Queue.", variant: "info" });
      } else {
        setToast({ message: "Student approved", variant: "success" });
      }
      await load();
    } catch (e: any) {
      setToast({ message: e?.message || "Failed", variant: "error" });
    } finally {
      setActing(null);
    }
  };

  const onReject = async (id: string) => {
    if (!token) return;
    setActing(id);
    try {
      await api.adminReject(token, id);
      setToast({ message: "Student rejected", variant: "info" });
      await load();
    } catch (e: any) {
      setToast({ message: e?.message || "Failed", variant: "error" });
    } finally {
      setActing(null);
    }
  };

  const meal: MealStat | null = useMemo(() => {
    if (!today) return null;
    return today[activeMeal];
  }, [today, activeMeal]);

  if (loading) {
    return (
      <SubscriptionGuard role="admin">
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
      </SubscriptionGuard>
    );
  }

  return (
    <SubscriptionGuard role="admin">
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Toast
        testID="admin-status-toast"
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onHide={() => setToast(null)}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={[styles.header, { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>ADMIN</Text>
            <Text style={styles.title}>Students Status</Text>
            <Text style={styles.subtitle}>
              Approvals, eating intent, preferences, reactions, reasons & feedback.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push("/notifications")}
            activeOpacity={0.7}
          >
            <Feather name="bell" size={24} color={c.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Summary tiles */}
        <View style={styles.tilesGrid}>
          <StatTile
            testID="tile-total"
            icon="users"
            label="Total students"
            value={summary?.total_students ?? 0}
          />
          <StatTile
            testID="tile-approved"
            icon="check-circle"
            label="Approved"
            tone="success"
            value={summary?.approved ?? 0}
          />
          <StatTile
            testID="tile-pending"
            icon="clock"
            label="Pending"
            tone="warning"
            value={summary?.pending ?? 0}
          />
          <StatTile
            testID="tile-blocked"
            icon="x-octagon"
            label="Blocked"
            tone="danger"
            value={summary?.blocked ?? 0}
          />
        </View>

        {/* Pending approvals */}
        <Text style={styles.sectionLabel}>Pending approvals ({pending.length})</Text>
        {pending.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No pending approvals 🎉</Text>
          </View>
        ) : (
          pending.map((s) => {
            const isPendingCapacity = (s as any).approval_status === "pending_capacity";
            return (
              <View key={s.id} style={[styles.studentCard, isPendingCapacity && { borderColor: c.warning, borderWidth: 1 }]} testID={`pending-${s.id}`}>
                <View style={styles.studentRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetter}>
                      {(s.full_name[0] || "?").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{s.full_name}</Text>
                    <Text style={styles.studentMeta}>
                      {s.email || s.mobile_or_user_id}
                    </Text>
                    <Text style={styles.studentMeta}>{s.institution_or_hostel_name}</Text>
                    {isPendingCapacity && (
                      <Text style={[styles.studentMeta, { color: c.warning, marginTop: 4, fontWeight: "500" }]}>
                        Reason: Institution has reached its purchased student capacity.
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.actionRow}>
                  {isPendingCapacity ? (
                    <TouchableOpacity
                      testID={`upgrade-${s.id}`}
                      activeOpacity={0.85}
                      style={[styles.actBtn, { backgroundColor: c.warning }]}
                      onPress={() => router.push("/(admin)/subscription" as any)}
                    >
                      <Feather name="arrow-up-circle" size={16} color="#fff" />
                      <Text style={styles.actBtnText}>Approve After Upgrade</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      testID={`approve-${s.id}`}
                      activeOpacity={0.85}
                      style={[styles.actBtn, { backgroundColor: c.primary }]}
                      onPress={() => onApprove(s.id)}
                      disabled={acting === s.id}
                    >
                      <Feather name="check" size={16} color="#fff" />
                      <Text style={styles.actBtnText}>Approve</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    testID={`reject-${s.id}`}
                    activeOpacity={0.85}
                    style={[styles.actBtn, { backgroundColor: c.inputBg }]}
                    onPress={() => onReject(s.id)}
                    disabled={acting === s.id}
                  >
                    <Feather name="x" size={16} color={c.danger} />
                    <Text style={[styles.actBtnText, { color: c.danger }]}>
                      Reject
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Today's summary */}
        <Text style={styles.sectionLabel}>Today · {today?.day ? cap(today.day) : ""}</Text>

        <View style={styles.tilesGrid}>
          <StatTile
            testID="tile-eating-breakfast"
            icon="coffee"
            label="Eating breakfast"
            value={today?.breakfast.eating_count ?? 0}
          />
          <StatTile
            testID="tile-eating-lunch"
            icon="sun"
            label="Eating lunch"
            value={today?.lunch.eating_count ?? 0}
          />
          <StatTile
            testID="tile-eating-dinner"
            icon="moon"
            label="Eating dinner"
            value={today?.dinner.eating_count ?? 0}
          />
          <StatTile
            testID="tile-responses"
            icon="check-square"
            label="Total responses"
            value={today?.total_responses ?? 0}
          />
        </View>

        {/* Meal-wise breakdown */}
        <Segmented<MealType>
          testID="status-meal"
          value={activeMeal}
          onChange={setActiveMeal}
          options={[
            { value: "breakfast", label: "Breakfast", testID: "status-meal-breakfast" },
            { value: "lunch", label: "Lunch", testID: "status-meal-lunch" },
            { value: "dinner", label: "Dinner", testID: "status-meal-dinner" },
          ]}
          style={{ marginVertical: spacing.md }}
        />

        {meal ? (
          <View style={styles.card} testID={`meal-detail-${activeMeal}`}>
            <View style={styles.titleRow}>
              <View style={styles.titleIcon}>
                <Feather name={MEAL_ICON[activeMeal]} size={18} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>{cap(activeMeal)}</Text>
            </View>

            <View style={styles.eatRow}>
              <View style={styles.eatBox}>
                <Text style={styles.eatNum}>{meal.eating_count}</Text>
                <Text style={styles.eatLabel}>Eating</Text>
              </View>
              <View style={styles.eatBox}>
                <Text style={[styles.eatNum, { color: colors.danger }]}>
                  {meal.not_eating_count}
                </Text>
                <Text style={styles.eatLabel}>Not eating</Text>
              </View>
            </View>

            <Text style={styles.subLabel}>Menu satisfaction</Text>
            <LikeDislikeBar
              testID={`like-bar-${activeMeal}`}
              likePct={meal.like_pct}
              dislikePct={meal.dislike_pct}
            />

            <Text style={styles.subLabel}>Item preference demand</Text>
            {meal.item_counts.length === 0 ? (
              <Text style={styles.muted}>No preferences submitted yet.</Text>
            ) : (
              meal.item_counts.map((row) => (
                <View key={row.item_name} style={styles.barRow}>
                  <Text style={styles.barName}>{row.item_name}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${
                            meal.item_counts.length === 0
                              ? 0
                              : Math.min(
                                  100,
                                  (row.count /
                                    Math.max(
                                      1,
                                      Math.max(
                                        ...meal.item_counts.map((x) => x.count),
                                      ),
                                    )) *
                                    100,
                                )
                          }%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barCount}>{row.count}</Text>
                </View>
              ))
            )}

            <Text style={styles.subLabel}>Reasons for not eating</Text>
            {meal.reason_counts.length === 0 ? (
              <Text style={styles.muted}>No reasons recorded.</Text>
            ) : (
              <View style={styles.kvList}>
                {meal.reason_counts.map((r) => (
                  <View key={r.reason} style={styles.kvRow}>
                    <Text style={styles.kvKey}>{r.reason}</Text>
                    <Text style={styles.kvValue}>{r.count}</Text>
                  </View>
                ))}
              </View>
            )}

            {meal.custom_question ? (
              <>
                <Text style={styles.subLabel}>{meal.custom_question.text}</Text>
                {meal.custom_answer_counts.length === 0 ? (
                  <Text style={styles.muted}>No answers yet.</Text>
                ) : (
                  <View style={styles.kvList}>
                    {meal.custom_answer_counts.map((a) => (
                      <View key={a.answer} style={styles.kvRow}>
                        <Text style={styles.kvKey}>{a.answer}</Text>
                        <Text style={styles.kvValue}>{a.count}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </View>
        ) : null}

        {/* Anonymous feedback */}
        <Text style={styles.sectionLabel}>Anonymous feedback · last 7 days</Text>
        {feedback.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No feedback yet.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {feedback.map((f, i) => (
              <View key={f.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.fbRow}>
                  <Feather
                    name="message-circle"
                    size={14}
                    color={colors.primary}
                    style={{ marginTop: 3 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fbText}>"{f.feedback_text}"</Text>
                    <Text style={styles.fbMeta}>Anonymous · {f.date}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Notification Modal */}
      <Modal
        visible={showNotifModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Notification</Text>
              <TouchableOpacity onPress={() => setShowNotifModal(false)} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Feather name="x" size={24} color={c.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Notification Title</Text>
            <TextInput
              style={styles.input}
              value={notifTitle}
              onChangeText={setNotifTitle}
              placeholder="e.g. Reminder"
              placeholderTextColor={c.textTertiary}
            />

            <Text style={styles.inputLabel}>Notification Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notifBody}
              onChangeText={setNotifBody}
              multiline
              textAlignVertical="top"
              placeholder="Type your message here..."
              placeholderTextColor={c.textTertiary}
            />

            <Text style={styles.inputLabel}>Live Preview</Text>
            <View style={styles.previewBox}>
              <View style={styles.previewRow}>
                <View style={styles.previewIcon}>
                  <Feather name="bell" size={14} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle} numberOfLines={1}>{notifTitle || "Title"}</Text>
                  <Text style={styles.previewBody}>{notifBody || "Message"}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, sendingNotif && { opacity: 0.6 }]}
              onPress={onSendNotification}
              disabled={sendingNotif}
            >
              {sendingNotif ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="send" size={16} color="#fff" />
                  <Text style={styles.sendBtnText}>Send Notification</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </SubscriptionGuard>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + 32 },
  header: { marginBottom: spacing.md },
  eyebrow: {
    ...typography.caption,
    color: c.primary,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  title: { ...typography.title1, color: c.textPrimary },
  subtitle: { ...typography.subhead, color: c.textSecondary, marginTop: 4 },
  sectionLabel: {
    ...typography.caption,
    color: c.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.md,
    marginLeft: 4,
    marginBottom: 8,
  },
  tilesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    backgroundColor: c.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  studentCard: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
    ...shadow.card,
  },
  studentRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: c.primary, fontSize: 18, fontWeight: "700" },
  studentName: { ...typography.headline, color: c.textPrimary },
  studentMeta: { ...typography.caption, color: c.textSecondary, marginTop: 1 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  actBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  actBtnText: { ...typography.subhead, color: "#fff", fontWeight: "700" },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md },
  titleIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { ...typography.title2, color: c.textPrimary },

  eatRow: { flexDirection: "row", gap: 12 },
  eatBox: {
    flex: 1,
    backgroundColor: c.inputBg,
    borderRadius: radius.md,
    padding: 12,
    alignItems: "center",
  },
  eatNum: { ...typography.title1, color: c.primary, fontSize: 26 },
  eatLabel: { ...typography.caption, color: c.textSecondary, marginTop: 2 },

  subLabel: {
    ...typography.footnote,
    color: c.textSecondary,
    marginTop: spacing.md,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  muted: { ...typography.subhead, color: c.textSecondary },

  barRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  barName: { ...typography.subhead, color: c.textPrimary, width: 100 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.inputBg,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: c.primary, borderRadius: 4 },
  barCount: {
    ...typography.subhead,
    color: c.textPrimary,
    fontWeight: "700",
    width: 40,
    textAlign: "right",
  },

  kvList: { gap: 6 },
  kvRow: { flexDirection: "row", justifyContent: "space-between" },
  kvKey: { ...typography.subhead, color: c.textSecondary },
  kvValue: { ...typography.subhead, color: c.textPrimary, fontWeight: "700" },

  divider: { height: 1, backgroundColor: c.border, marginVertical: 8 },
  fbRow: { flexDirection: "row", gap: 8, paddingVertical: 6 },
  fbText: { ...typography.subhead, color: c.textPrimary, lineHeight: 20 },
  fbMeta: { ...typography.caption, color: c.textTertiary, marginTop: 2 },

  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: c.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.headline, color: c.textPrimary },
  inputLabel: {
    ...typography.caption,
    color: c.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: c.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: c.textPrimary,
    ...typography.body,
    minHeight: 48,
  },
  textArea: { minHeight: 80, paddingTop: 14 },
  previewBox: {
    backgroundColor: c.inputBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: 4,
  },
  previewRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  previewTitle: { ...typography.subhead, color: c.textPrimary, fontWeight: "600", marginBottom: 2 },
  previewBody: { ...typography.caption, color: c.textSecondary, lineHeight: 18 },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
    marginTop: spacing.xl,
  },
  sendBtnText: { ...typography.body, color: "#fff", fontWeight: "700" },
});
