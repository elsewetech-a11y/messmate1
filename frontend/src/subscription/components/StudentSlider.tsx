import React, { useMemo } from "react";
import { StyleSheet, Text, View, TextInput } from "react-native";
import Slider from "@react-native-community/slider";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";
import { PRICING_CONFIG, calculateMonthlyPrice, calculateYearlyPrice } from "../constants/pricingConfig";
import type { BillingCycle } from "../hooks/useSubscriptionCalculator";

type StudentSliderProps = {
  students: number;
  onSliderChange: (val: number) => void;
  onInputChange: (val: number) => void;
  onInputBlur: () => void;
  billingCycle?: BillingCycle;
};

export function StudentSlider({ students, onSliderChange, onInputChange, onInputBlur, billingCycle = "monthly" }: StudentSliderProps) {
  const { c, mode } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const handleTextChange = (text: string) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue === '') {
      onInputChange(0);
    } else {
      onInputChange(parseInt(numericValue, 10));
    }
  };

  const isInvalid = students < PRICING_CONFIG.MIN_STUDENTS || students > PRICING_CONFIG.MAX_STUDENTS;
  const isValid = !isInvalid && students > 0;

  // Calculate live price for display
  const livePrice = billingCycle === "monthly"
    ? calculateMonthlyPrice(isValid ? students : PRICING_CONFIG.MIN_STUDENTS)
    : calculateYearlyPrice(isValid ? students : PRICING_CONFIG.MIN_STUDENTS);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Student Capacity</Text>
      <Text style={styles.subtitle}>Select the number of students connected to your institution.</Text>

      {/* Live price display */}
      <View style={styles.livePriceContainer}>
        <Text style={styles.livePriceLabel}>{isValid ? students.toLocaleString() : "—"} Students</Text>
        <Text style={styles.livePriceAmount}>
          ₹{isValid ? livePrice.toLocaleString() : "—"}
          <Text style={styles.livePricePeriod}>
            {billingCycle === "monthly" ? "/month" : "/year"}
          </Text>
        </Text>
      </View>

      <View style={styles.sliderContainer}>
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={PRICING_CONFIG.MIN_STUDENTS}
          maximumValue={PRICING_CONFIG.MAX_STUDENTS}
          step={1}
          value={students >= PRICING_CONFIG.MIN_STUDENTS && students <= PRICING_CONFIG.MAX_STUDENTS ? students : PRICING_CONFIG.MIN_STUDENTS}
          onValueChange={onSliderChange}
          minimumTrackTintColor={c.primary}
          maximumTrackTintColor={c.border}
          thumbTintColor={mode === 'dark' ? c.primaryLight : c.primary}
          testID="student-slider"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>{PRICING_CONFIG.MIN_STUDENTS}</Text>
          <Text style={styles.sliderLabelText}>{PRICING_CONFIG.MAX_STUDENTS.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Enter Total Number of Students:</Text>
        <TextInput
          testID="student-count-input"
          style={[styles.input, isInvalid && styles.inputError]}
          keyboardType="numeric"
          value={students === 0 ? "" : students.toString()}
          onChangeText={handleTextChange}
          onBlur={onInputBlur}
          placeholder={PRICING_CONFIG.MIN_STUDENTS.toString()}
          placeholderTextColor={c.textTertiary}
        />
      </View>

      {students === 0 ? (
        <Text style={styles.errorText}>Please enter the total number of students.</Text>
      ) : students < PRICING_CONFIG.MIN_STUDENTS ? (
        <Text style={styles.errorText}>Minimum subscription size is {PRICING_CONFIG.MIN_STUDENTS} students.</Text>
      ) : students > PRICING_CONFIG.MAX_STUDENTS ? (
        <Text style={styles.errorText}>Maximum supported subscription size is {PRICING_CONFIG.MAX_STUDENTS.toLocaleString()} students.</Text>
      ) : null}
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
    title: {
      ...typography.title2,
      color: c.textPrimary,
      marginBottom: 4,
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      marginBottom: 16,
    },
    livePriceContainer: {
      backgroundColor: c.primaryLight,
      borderRadius: radius.md,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: "center",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: c.primaryTint,
    },
    livePriceLabel: {
      ...typography.body,
      fontWeight: "600",
      color: c.textPrimary,
      marginBottom: 4,
    },
    livePriceAmount: {
      fontSize: 32,
      fontWeight: "700",
      color: c.primaryDark,
    },
    livePricePeriod: {
      fontSize: 16,
      fontWeight: "500",
      color: c.textSecondary,
    },
    sliderContainer: {
      marginBottom: 24,
    },
    sliderLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 10,
    },
    sliderLabelText: {
      ...typography.caption,
      color: c.textTertiary,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    inputLabel: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: "500",
      flex: 1,
    },
    input: {
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: 16,
      paddingVertical: 10,
      width: 120,
      textAlign: "center",
      ...typography.title2,
      color: c.textPrimary,
    },
    inputError: {
      borderColor: c.danger,
    },
    errorText: {
      ...typography.caption,
      color: c.danger,
      marginTop: 8,
      textAlign: "right",
    },
  });
