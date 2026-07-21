import re
import sys

with open('frontend/src/api/client.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'studentNotifications: (token: string) =>' in line:
        start_idx = i
    if 'adminDeleteScheduledNotification:' in line:
        # the endpoint takes about 5 lines
        end_idx = i + 5

if start_idx == -1 or end_idx == -1:
    print("Could not find boundaries")
    sys.exit(1)

new_content = """  studentNotifications: (token: string) =>
    request<{
      items: {
        id: string;
        title: string;
        message: string;
        date: string;
        time: string;
        created_at: string;
        read_status: boolean;
      }[];
      unread_count: number;
    }>("/student/notifications", { token }),
  markNotifRead: (token: string, id: string) =>
    request<{ ok: boolean }>(`/student/notifications/${id}/read`, {
      method: "POST",
      token,
    }),
  deleteStudentNotif: (token: string, id: string) =>
    request<{ ok: boolean }>(`/student/notifications/${id}`, {
      method: "DELETE",
      token,
    }),
  clearStudentNotifs: (token: string) =>
    request<{ ok: boolean }>(`/student/notifications/clear`, {
      method: "POST",
      token,
    }),
  adminNotifications: (token: string) =>
    request<{
      items: {
        id: string;
        institution_or_hostel_name: string;
        category: string;
        title: string;
        description: string;
        created_at: string;
        read_status: boolean;
        action_url?: string;
      }[];
    }>("/admin/notifications", { token }),
  markAdminNotifRead: (token: string, id: string) =>
    request<{ ok: boolean }>(`/admin/notifications/${id}/read`, {
      method: "POST",
      token,
    }),
  deleteAdminNotif: (token: string, id: string) =>
    request<{ ok: boolean }>(`/admin/notifications/${id}`, {
      method: "DELETE",
      token,
    }),
  clearAdminNotifs: (token: string) =>
    request<{ ok: boolean }>(`/admin/notifications/clear`, {
      method: "POST",
      token,
    }),
  adminPushImmediate: (
    token: string,
    body: {
      title: string;
      message: string;
    },
  ) =>
    request<{ ok: boolean; delivered_count: number }>("/admin/notifications/push/immediate", {
      method: "POST",
      body,
      token,
    }),
  adminPushSchedule: (
    token: string,
    body: {
      title: string;
      message: string;
      notificationType: "Immediate" | "Scheduled";
      daysSelection?: string[];
      scheduledTime?: string;
      repeatOption?: "Send Once" | "Repeat Weekly" | "Repeat Every Selected Day";
    },
  ) =>
    request<any>("/admin/notifications/push/schedule", {
      method: "POST",
      body,
      token,
    }),
  adminPushScheduleList: (token: string) =>
    request<{ items: any[] }>("/admin/notifications/push/schedule", { token }),
  adminPushScheduleUpdate: (
    token: string,
    id: string,
    body: any,
  ) =>
    request<any>(`/admin/notifications/push/schedule/${id}`, {
      method: "PUT",
      body,
      token,
    }),
  adminPushScheduleDelete: (token: string, id: string) =>
    request<null>(`/admin/notifications/push/schedule/${id}`, {
      method: "DELETE",
      token,
    }),
  adminPushTest: (
    token: string,
    body: {
      title: string;
      message: string;
    },
  ) =>
    request<{ ok: boolean; delivered_count: number }>("/admin/notifications/push/test", {
      method: "POST",
      body,
      token,
    }),
"""

new_lines = lines[:start_idx] + [new_content] + lines[end_idx:]

with open('frontend/src/api/client.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Success")
