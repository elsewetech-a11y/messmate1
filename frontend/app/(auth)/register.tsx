// Registration — email + password + institution. Sends OTP to email then
// navigates to verify-email.

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";



import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { spacing, typography, useTheme, type ThemeColors } from "@/src/theme";

function validEmail(s: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s.trim());
}

export default function Register() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const role = (params.role === "admin" ? "admin" : "student") as "student" | "admin";
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [hostel, setHostel] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [roomNumber, setRoomNumber] = useState("");


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!fullName.trim() || !email.trim() || !hostel.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (role === "student") {
      if (!department.trim()) {
        setError("Please enter your Department.");
        return;
      }
      if (!academicYear.trim()) {
        setError("Please enter your Academic Year.");
        return;
      }
      const trimmedYr = academicYear.trim();
      const validText = ["First Year", "Second Year", "Third Year", "Fourth Year", "Final Year"].includes(trimmedYr);
      const isNum = /^[1-9]\d*$/.test(trimmedYr);
      if (!validText && !isNum) {
        setError("Academic Year must be a positive whole number or a valid year name (e.g., First Year).");
        return;
      }
    }
    if (!validEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        confirm_password: confirm,
        institution_or_hostel_name: hostel.trim(),
        role,
        department: role === "student" ? department.trim() : undefined,
        academic_year: role === "student" ? academicYear.trim() : undefined,
        roll_number: role === "student" ? rollNumber.trim() : undefined,
        room_number: role === "student" ? roomNumber.trim() || undefined : undefined,
      });
      if (res.dev_otp) {
        // Show an alert on both mobile and web if in dev mode
        if (Platform.OS === "web") {
          window.alert(`[DEV MODE] Your OTP is: ${res.dev_otp}`);
        } else {
          Alert.alert("DEV MODE", `Your OTP is: ${res.dev_otp}`);
        }
      }
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: email.trim(), from: "register" },
      });
    } catch (e: any) {
      setError(e?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            testID="back-button"
            onPress={() => router.back()}
            style={styles.back}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="chevron-left" size={26} color={c.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.title} testID="register-title">
            {role === "admin" ? "Create admin account" : "Create your account"}
          </Text>
          <Text style={styles.subtitle}>
            {role === "admin"
              ? "You'll get started right after verifying your email."
              : "Submit your details — the admin will approve you after email verification."}
          </Text>

          <View style={{ marginTop: spacing.xl }}>
            <Input testID="register-fullname-input" label="Full name" placeholder="e.g., Aarav Kumar" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <Input
              testID="register-email-input"
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              testID="register-hostel-input"
              label="Institution / Hostel name"
              placeholder="e.g., Sunrise Hostel"
              value={hostel}
              onChangeText={setHostel}
              autoCapitalize="words"
            />
            {role === "student" && (
              <>
                <Input
                  label="Department *"
                  placeholder="e.g., Computer Science and Engineering"
                  value={department}
                  onChangeText={(text) => {
                    // Allow letters, numbers, spaces, hyphens, ampersands, periods, parentheses
                    if (/^[A-Za-z0-9 .&()\-]*$/.test(text) && text.length <= 100) {
                      setDepartment(text);
                    }
                  }}
                  autoCapitalize="words"
                  maxLength={100}
                />
                <Input
                  label="Academic Year *"
                  placeholder="e.g., 1 or First Year"
                  value={academicYear}
                  onChangeText={setAcademicYear}
                />
                <Input
                  label="Roll Number (Optional)"
                  placeholder="e.g., CS2023001"
                  value={rollNumber}
                  onChangeText={setRollNumber}
                  autoCapitalize="characters"
                />
                <Input
                  label="Room Number (Optional)"
                  placeholder="e.g., A-101, B203, G-12"
                  value={roomNumber}
                  onChangeText={(text) => {
                    if (text.length <= 20) setRoomNumber(text);
                  }}
                  autoCapitalize="characters"
                  maxLength={20}
                />
              </>
            )}
            <Input testID="register-password-input" label="Password" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secureTextEntry />
            <Input testID="register-confirm-input" label="Confirm password" placeholder="Re-enter your password" value={confirm} onChangeText={setConfirm} secureTextEntry />

            {error ? (
              <Text style={styles.error} testID="register-error">{error}</Text>
            ) : null}

            <Button
              testID="register-submit"
              label="Create account"
              onPress={onSubmit}
              loading={loading}
              style={{ marginTop: spacing.md }}
            />

            {/* Terms & Privacy notice */}
            <View style={styles.legalRow}>
              <Text style={styles.legalText}>By creating an account you agree to our{" "}</Text>
              <TouchableOpacity
                testID="register-terms-link"
                onPress={() => router.push("/(auth)/terms-and-conditions")}
              >
                <Text style={styles.legalLink}>Terms</Text>
              </TouchableOpacity>
              <Text style={styles.legalText}>{" "}and{" "}</Text>
              <TouchableOpacity
                testID="register-privacy-link"
                onPress={() => router.push("/(auth)/privacy-policy")}
              >
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity
                testID="register-back-to-login"
                onPress={() =>
                  router.replace(role === "admin" ? "/(auth)/admin-login" : "/(auth)/student-login")
                }
              >
                <Text style={styles.linkStrong}> Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>



    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { padding: spacing.lg, paddingBottom: spacing.xl },
    back: { width: 36, height: 36, justifyContent: "center", marginBottom: spacing.md },
    title: { ...typography.largeTitle, color: c.textPrimary, marginBottom: 6 },
    subtitle: { ...typography.callout, color: c.textSecondary, lineHeight: 22 },
    error: { color: c.danger, ...typography.subhead, marginTop: 4, marginBottom: 4 },
    legalRow: {
      marginTop: spacing.md,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
    },
    legalText: { ...typography.footnote, color: c.textTertiary },
    legalLink: { ...typography.footnote, color: c.primary, fontWeight: "600" },
    footer: { marginTop: spacing.sm, flexDirection: "row", justifyContent: "center" },
    footerText: { ...typography.subhead, color: c.textSecondary },
    linkStrong: { ...typography.subhead, color: c.primary, fontWeight: "600" },

  });
