import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";

const features = [
  { name: "Student Management", trial: true, monthly: true, yearly: true },
  { name: "Menu Management", trial: true, monthly: true, yearly: true },
  { name: "Notifications", trial: true, monthly: true, yearly: true },
  { name: "Analytics", trial: true, monthly: true, yearly: true },
  { name: "Reports", trial: true, monthly: true, yearly: true },
  { name: "Priority Support", trial: false, monthly: false, yearly: true },
];

export function ComparisonTable() {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const renderIcon = (included: boolean) => {
    return included ? (
      <Feather name="check" size={18} color={c.success} />
    ) : (
      <Feather name="x" size={18} color={c.textTertiary} />
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Plan Features</Text>
      
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Feature</Text>
        <Text style={styles.headerCell}>Trial</Text>
        <Text style={styles.headerCell}>Mo.</Text>
        <Text style={styles.headerCell}>Yr.</Text>
      </View>
      
      {features.map((item, index) => (
        <View 
          key={item.name} 
          style={[
            styles.row, 
            index === features.length - 1 && { borderBottomWidth: 0 }
          ]}
        >
          <Text style={[styles.cell, { flex: 2, textAlign: "left" }]}>{item.name}</Text>
          <View style={styles.iconCell}>{renderIcon(item.trial)}</View>
          <View style={styles.iconCell}>{renderIcon(item.monthly)}</View>
          <View style={styles.iconCell}>{renderIcon(item.yearly)}</View>
        </View>
      ))}
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
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: "row",
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
      marginBottom: 8,
    },
    headerCell: {
      flex: 1,
      ...typography.caption,
      fontWeight: "700",
      color: c.textSecondary,
      textAlign: "center",
    },
    row: {
      flexDirection: "row",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
      alignItems: "center",
    },
    cell: {
      flex: 1,
      ...typography.body,
      color: c.textPrimary,
    },
    iconCell: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });
