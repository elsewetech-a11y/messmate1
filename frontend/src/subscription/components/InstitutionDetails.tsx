import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";

type InstitutionDetailsProps = {
  institutionName: string;
  hostelName: string;
  institutionCode: string;
  registeredStudents: number;
  studentLimit: number;
  currentPlan: string;
  subscriptionStatus: string;
};

export function InstitutionDetails({
  institutionName,
  hostelName,
  institutionCode,
  registeredStudents,
  studentLimit,
  currentPlan,
  subscriptionStatus,
}: InstitutionDetailsProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="home" size={20} color={c.primary} />
        <Text style={styles.title}>Institution Details</Text>
      </View>
      <View style={styles.divider} />
      
      <View style={styles.row}>
        <Text style={styles.label}>Institution Name:</Text>
        <Text style={styles.value}>{institutionName}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Hostel Name:</Text>
        <Text style={styles.value}>{hostelName}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Institution Code:</Text>
        <Text style={styles.value}>{institutionCode}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Registered Students:</Text>
        <Text style={styles.value}>{registeredStudents}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Purchased Capacity:</Text>
        <Text style={styles.value}>{studentLimit}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Current Plan:</Text>
        <Text style={styles.value}>{currentPlan}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Subscription Status:</Text>
        <Text style={[
          styles.value, 
          { color: subscriptionStatus === 'Active' ? c.success : (subscriptionStatus === 'Free Trial' ? c.warning : c.danger) }
        ]}>{subscriptionStatus}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      ...shadow.card,
      marginBottom: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    title: {
      ...typography.title2,
      color: c.textPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: c.divider,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    label: {
      ...typography.body,
      color: c.textSecondary,
    },
    value: {
      ...typography.body,
      fontWeight: "600",
      color: c.textPrimary,
    },
  });
