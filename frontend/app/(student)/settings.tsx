// Student Settings — profile + account/app placeholders + logout.

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput, Switch, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Button } from "@/src/components/Button";
import { NotifBell } from "@/src/components/NotifBell";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { Toast } from "@/src/components/Toast";
import { radius, shadow, spacing, typography, colors, useTheme, type ThemeColors } from "@/src/theme";

type Row = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  testID: string;
  onPress?: () => void;
  disabledNote?: boolean;
};

function SettingsRow({ icon, label, value, testID, onPress, disabledNote }: Row) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
    >
      <View style={styles.rowIcon}>
        <Feather name={icon} size={18} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {disabledNote ? <Text style={styles.rowMuted}>Coming soon</Text> : null}
      </View>
      <Feather
        name="chevron-right"
        size={18}
        color={onPress ? c.textSecondary : c.textTertiary}
      />
    </TouchableOpacity>
  );
}

export default function StudentSettings() {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { user, token, logout } = useAuth();
  const router = useRouter();

  // Modals state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Forgot Password state within Change Password modal
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "reset">("email");
  const [forgotEmail, setForgotEmail] = useState(user?.email || "");
  const [forgotOtp, setForgotOtp] = useState("");
  const [resetToken, setResetToken] = useState("");

  // Notifications state
  const [notifSettings, setNotifSettings] = useState<any>({
    in_app_notifications: true,
    sound: true,
    vibration: true,
  });
  const [notifLoading, setNotifLoading] = useState(true);

  // Toast
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" | "info" } | null>(null);

  const loadNotifSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.getNotificationSettings(token);
      if (res) {
        setNotifSettings(res);
      }
    } catch (e: any) {
      // failed to load, keep defaults
    } finally {
      setNotifLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadNotifSettings();
    }
  }, [token, loadNotifSettings]);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToast({ message: "All fields are required", variant: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: "New passwords do not match", variant: "error" });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ message: "Password must be at least 8 characters", variant: "error" });
      return;
    }

    try {
      setPasswordLoading(true);
      await api.changePassword(token!, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setToast({ message: "Password updated successfully.", variant: "success" });
      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to change password", variant: "error" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      setToast({ message: "Email is required", variant: "error" });
      return;
    }
    try {
      setPasswordLoading(true);
      await api.forgotPassword({ email: forgotEmail });
      setToast({ message: "OTP sent to your email", variant: "info" });
      setForgotStep("otp");
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to send OTP", variant: "error" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!forgotOtp) {
      setToast({ message: "OTP is required", variant: "error" });
      return;
    }
    try {
      setPasswordLoading(true);
      const res = await api.forgotPasswordVerify({ email: forgotEmail, otp: forgotOtp });
      setResetToken(res.reset_token);
      setForgotStep("reset");
    } catch (e: any) {
      setToast({ message: e?.message || "Invalid OTP", variant: "error" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setToast({ message: "All fields are required", variant: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: "Passwords do not match", variant: "error" });
      return;
    }
    try {
      setPasswordLoading(true);
      await api.resetPassword({
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setToast({ message: "Password reset successfully.", variant: "success" });
      setShowPasswordModal(false);
      setIsForgotPassword(false);
      setForgotStep("email");
      setNewPassword("");
      setConfirmPassword("");
      setForgotOtp("");
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to reset password", variant: "error" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdateNotif = async (key: string, value: boolean) => {
    const next = { ...notifSettings, [key]: value };
    setNotifSettings(next);
    try {
      await api.updateNotificationSettings(token!, next);
    } catch (e: any) {
      setToast({ message: "Failed to update notification settings", variant: "error" });
      // Revert if needed, but optimistic is fine here.
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>STUDENT</Text>
            <Text style={styles.title}>Settings</Text>
          </View>
          <NotifBell testID="student-settings-bell" />
        </View>

        {/* Profile card */}
        <View style={[styles.card, styles.profileCard]} testID="student-profile-card">
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {(user?.full_name?.[0] || "S").toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName} testID="student-profile-name">
            {user?.full_name || "Student"}
          </Text>
          <Text style={styles.profileSub} testID="student-profile-sub">
            {user?.institution_or_hostel_name || "—"}
          </Text>
          {user?.institution_or_hostel_name ? (
            <View style={styles.roomBadge}>
              <Text style={styles.roomBadgeText}>{user.institution_or_hostel_name}</Text>
            </View>
          ) : null}
        </View>

        {/* Profile details */}
        <Text style={styles.sectionLabel}>Profile</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="user"
            label="Full name"
            value={user?.full_name || "—"}
            testID="student-row-name"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="mail"
            label="Email"
            value={user?.email || user?.mobile_or_user_id || "—"}
            testID="student-row-email"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="home"
            label="Institution / Hostel"
            value={user?.institution_or_hostel_name || "—"}
            testID="student-row-hostel"
          />
          {user?.department && (
            <>
              <View style={styles.divider} />
              <SettingsRow
                icon="book"
                label="Department"
                value={user.department}
                testID="student-row-department"
              />
            </>
          )}
          {user?.academic_year && (
            <>
              <View style={styles.divider} />
              <SettingsRow
                icon="calendar"
                label="Academic Year"
                value={user.academic_year}
                testID="student-row-academic-year"
              />
            </>
          )}
          {user?.roll_number && (
            <>
              <View style={styles.divider} />
              <SettingsRow
                icon="hash"
                label="Roll Number"
                value={user.roll_number}
                testID="student-row-roll-number"
              />
            </>
          )}
          {(user as any)?.room_number && (
            <>
              <View style={styles.divider} />
              <SettingsRow
                icon="map-pin"
                label="Room Number"
                value={(user as any).room_number}
                testID="student-row-room-number"
              />
            </>
          )}
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="lock"
            label="Change password"
            testID="student-row-change-password"
            onPress={() => setShowPasswordModal(true)}
          />
        </View>

        {/* App */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <ThemeToggle />
        </View>

        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="bell"
            label="Notifications"
            testID="student-row-notifications"
            disabledNote={true}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="globe"
            label="Language"
            value="English"
            testID="student-row-language"
          />
        </View>

        {/* Legal */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.card}>
          <TouchableOpacity
            testID="student-row-privacy"
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => router.push("/(auth)/privacy-policy")}
          >
            <View style={styles.rowIcon}>
              <Feather name="shield" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
            </View>
            <Feather name="chevron-right" size={18} color={c.textSecondary} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            testID="student-row-terms"
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => router.push("/(auth)/terms-and-conditions")}
          >
            <View style={styles.rowIcon}>
              <Feather name="file-text" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Terms &amp; Conditions</Text>
            </View>
            <Feather name="chevron-right" size={18} color={c.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Contact Support */}
        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.card}>
          <TouchableOpacity
            testID="student-row-contact-support"
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('mailto:elsewe.tech@gmail.com?subject=MessMate Support')}
          >
            <View style={styles.rowIcon}>
              <Feather name="mail" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Contact Support</Text>
              <Text style={styles.rowValue}>elsewe.tech@gmail.com</Text>
            </View>
            <Feather name="chevron-right" size={18} color={c.textSecondary} />
          </TouchableOpacity>
        </View>

        <Button
          testID="student-settings-logout"
          label="Sign out"
          variant="secondary"
          onPress={logout}
          style={{ marginTop: spacing.lg }}
        />

        <Text style={styles.versionText}>MessMate · v0.1.0</Text>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPasswordModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
              <Feather name="x" size={24} color={c.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{isForgotPassword ? "Forgot Password" : "Change Password"}</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.modalContent}>
            {!isForgotPassword ? (
              <>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter current password"
                  placeholderTextColor={c.textTertiary}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor={c.textTertiary}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor={c.textTertiary}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <Button
                  label={passwordLoading ? "Updating..." : "Update Password"}
                  onPress={handleChangePassword}
                  disabled={passwordLoading}
                  style={{ marginTop: spacing.md }}
                />
                <TouchableOpacity onPress={() => setIsForgotPassword(true)} style={{ marginTop: spacing.lg, padding: spacing.sm }}>
                  <Text style={{ textAlign: "center", color: c.primary, ...typography.subhead }}>Forgot Password?</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {forgotStep === "email" && (
                  <>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor={c.textTertiary}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                    />
                    <Button
                      label={passwordLoading ? "Sending OTP..." : "Send OTP"}
                      onPress={handleForgotPassword}
                      disabled={passwordLoading}
                      style={{ marginTop: spacing.md }}
                    />
                  </>
                )}
                {forgotStep === "otp" && (
                  <>
                    <Text style={styles.inputLabel}>Enter OTP</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter OTP sent to email"
                      placeholderTextColor={c.textTertiary}
                      keyboardType="number-pad"
                      value={forgotOtp}
                      onChangeText={setForgotOtp}
                    />
                    <Button
                      label={passwordLoading ? "Verifying..." : "Verify OTP"}
                      onPress={handleVerifyOtp}
                      disabled={passwordLoading}
                      style={{ marginTop: spacing.md }}
                    />
                  </>
                )}
                {forgotStep === "reset" && (
                  <>
                    <Text style={styles.inputLabel}>New Password</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter new password"
                      placeholderTextColor={c.textTertiary}
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <Text style={styles.inputLabel}>Confirm New Password</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter new password"
                      placeholderTextColor={c.textTertiary}
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <Button
                      label={passwordLoading ? "Resetting..." : "Reset Password"}
                      onPress={handleResetPassword}
                      disabled={passwordLoading}
                      style={{ marginTop: spacing.md }}
                    />
                  </>
                )}
                <TouchableOpacity onPress={() => setIsForgotPassword(false)} style={{ marginTop: spacing.lg, padding: spacing.sm }}>
                  <Text style={{ textAlign: "center", color: c.textSecondary, ...typography.subhead }}>Back to Change Password</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal visible={showNotifModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowNotifModal(false)}>
              <Feather name="x" size={24} color={c.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Notifications</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.modalContent}>
            {notifLoading ? (
              <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
            ) : (
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>In-App Notifications</Text>
                  </View>
                  <Switch
                    value={notifSettings.in_app_notifications}
                    onValueChange={(val) => handleUpdateNotif("in_app_notifications", val)}
                    trackColor={{ true: c.primary, false: c.border }}
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Notification Sound</Text>
                  </View>
                  <Switch
                    value={notifSettings.sound}
                    onValueChange={(val) => handleUpdateNotif("sound", val)}
                    trackColor={{ true: c.primary, false: c.border }}
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Notification Vibration</Text>
                  </View>
                  <Switch
                    value={notifSettings.vibration}
                    onValueChange={(val) => handleUpdateNotif("vibration", val)}
                    trackColor={{ true: c.primary, false: c.border }}
                  />
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

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

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.lg, paddingBottom: 120 },
  header: { marginBottom: spacing.md },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.caption,
    color: c.primary,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  title: { ...typography.title1, color: c.textPrimary },

  card: {
    backgroundColor: c.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  profileCard: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarLetter: { color: "#fff", fontSize: 30, fontWeight: "700" },
  profileName: { ...typography.title2, color: c.textPrimary },
  profileSub: { ...typography.subhead, color: c.textSecondary, marginTop: 4 },
  roomBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: c.primaryLight,
  },
  roomBadgeText: {
    ...typography.caption,
    color: c.primaryDark,
    fontWeight: "700",
  },

  sectionLabel: {
    ...typography.caption,
    color: c.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 6,
    marginBottom: 8,
    marginTop: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { ...typography.subhead, color: c.textPrimary, fontWeight: "600" },
  rowValue: { ...typography.caption, color: c.textSecondary, marginTop: 2 },
  rowMuted: { ...typography.caption, color: c.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: c.border, marginLeft: 48 },

  versionText: {
    ...typography.caption,
    color: c.textTertiary,
    textAlign: "center",
    marginTop: spacing.lg,
  },

  modalContainer: { flex: 1, backgroundColor: c.bg },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  modalTitle: { ...typography.title2, color: c.textPrimary, fontWeight: "600" },
  modalContent: { padding: spacing.lg },
  inputLabel: {
    ...typography.subhead,
    color: c.textPrimary,
    fontWeight: "600",
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: c.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: c.textPrimary,
    ...typography.body,
    ...shadow.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  switchLabel: { ...typography.subhead, color: c.textPrimary, fontWeight: "500" },
});
