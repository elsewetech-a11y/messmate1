import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { radius, shadow, typography, useTheme, type ThemeColors } from "@/src/theme";
import type { SubscriptionEventPublic } from "@/src/api/client";

type SubscriptionTimelineProps = {
  events: SubscriptionEventPublic[];
};

function formatEventName(type: string) {
  switch (type) {
    case "TRIAL_STARTED": return "Free Trial Started";
    case "TRIAL_EXPIRED": return "Free Trial Expired";
    case "SUBSCRIPTION_PURCHASED": return "Subscription Purchased/Renewed";
    case "CAPACITY_UPGRADE": return "Student Capacity Increased";
    default: return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  }
}

export function SubscriptionTimeline({ events }: SubscriptionTimelineProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  if (!events || events.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Activity Timeline</Text>
        <Text style={styles.emptyText}>No subscription events found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Activity Timeline</Text>
      
      <View style={styles.timeline}>
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          const dateStr = new Date(event.event_date).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });

          return (
            <View key={event.id} style={styles.eventRow}>
              <View style={styles.timelineLeft}>
                <View style={styles.dot} />
                {!isLast && <View style={styles.line} />}
              </View>
              <View style={styles.eventContent}>
                <Text style={styles.eventDate}>{dateStr}</Text>
                <Text style={styles.eventName}>{formatEventName(event.event_type)}</Text>
                
                {event.event_type === "CAPACITY_UPGRADE" && event.details && (
                  <Text style={styles.eventDetail}>
                    {event.details.old_capacity} → {event.details.new_capacity} Students
                  </Text>
                )}
                
                {event.event_type === "SUBSCRIPTION_PURCHASED" && event.details?.plan_type && (
                  <Text style={styles.eventDetail}>
                    Plan: {event.details.plan_type === "yearly" ? "Yearly" : "Monthly"} ({event.details.capacity} Students)
                  </Text>
                )}
              </View>
            </View>
          );
        })}
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
    title: {
      ...typography.title2,
      color: c.textPrimary,
      marginBottom: 16,
    },
    emptyText: {
      ...typography.body,
      color: c.textSecondary,
      fontStyle: "italic",
    },
    timeline: {
      paddingLeft: 4,
    },
    eventRow: {
      flexDirection: "row",
    },
    timelineLeft: {
      alignItems: "center",
      marginRight: 16,
      width: 12,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.primary,
      zIndex: 1,
    },
    line: {
      width: 2,
      flex: 1,
      backgroundColor: c.border,
      marginTop: -2,
      marginBottom: -2,
    },
    eventContent: {
      flex: 1,
      paddingBottom: 24,
    },
    eventDate: {
      ...typography.caption,
      color: c.textSecondary,
      marginBottom: 4,
    },
    eventName: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: "600",
      marginBottom: 4,
    },
    eventDetail: {
      ...typography.caption,
      color: c.primary,
      fontWeight: "500",
    },
  });
