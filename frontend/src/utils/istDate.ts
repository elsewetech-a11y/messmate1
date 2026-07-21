/**
 * IST (Indian Standard Time) Date Utilities — Asia/Kolkata (UTC +05:30)
 *
 * ALL user-facing date/time display must go through these helpers.
 * Never call `new Date()` or `Date.now()` directly for display purposes.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in ms

/** 
 * Returns a Date object where .getHours()/.getMinutes() give the current IST time.
 * Works correctly regardless of the device's local timezone.
 *
 * Logic: IST = UTC + 5:30. Device local = UTC - localOffset.
 * To make .getHours() show IST hours, we create a Date shifted by:
 * IST_OFFSET + localOffset (both in ms)
 *
 * Example at 11:35 PM PDT (UTC-7):
 *   UTC = 06:35 AM July 16 → IST = 12:05 PM July 16
 *   nowIST().getHours() → 12 ✅
 */
export function nowIST(): Date {
  const now = new Date();
  const localOffsetMs = now.getTimezoneOffset() * 60000; // +ve for west-of-UTC zones
  return new Date(now.getTime() + IST_OFFSET_MS + localOffsetMs);
}

/**
 * Returns the current date in IST as a YYYY-MM-DD string.
 * Use this wherever you need today's ISO date for API calls.
 */
export function todayISOinIST(): string {
  const now = new Date();
  // Shift to IST
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(istDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses an ISO date string (YYYY-MM-DD or full ISO) and returns a Date
 * object anchored to IST midnight, avoiding any local-timezone shift.
 */
export function parseISODateAsIST(isoStr: string): Date {
  if (!isoStr) return new Date(NaN);
  // If it's a date-only string (YYYY-MM-DD), append IST midnight
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoStr);
  if (isDateOnly) {
    // Treat as IST midnight by appending +05:30
    return new Date(`${isoStr}T00:00:00+05:30`);
  }
  return new Date(isoStr);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/**
 * Formats an IST Date object as "DD Month YYYY"
 * Example: "15 July 2026"
 */
export function formatDateIST(date: Date): string {
  if (isNaN(date.getTime())) return "";
  // Convert UTC time to IST
  const istMs = date.getTime() + IST_OFFSET_MS;
  const d = new Date(istMs);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Returns the full day name for an IST Date object.
 * Example: "Wednesday"
 */
export function getDayNameIST(date: Date): string {
  if (isNaN(date.getTime())) return "";
  const istMs = date.getTime() + IST_OFFSET_MS;
  const d = new Date(istMs);
  return DAY_NAMES[d.getUTCDay()];
}

/**
 * Formats time in 12-hour IST format from an API/ISO-sourced Date.
 * Uses the UTC-shift approach: date from parseISODateAsIST() or API timestamps.
 * Example: "08:30 PM"
 */
export function formatTimeIST(date: Date): string {
  if (isNaN(date.getTime())) return "";
  const istMs = date.getTime() + IST_OFFSET_MS;
  const d = new Date(istMs);
  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

/**
 * Formats time in 12-hour IST format from a Date returned by nowIST() or
 * a DateTimePicker — reads .getHours()/.getMinutes() which already hold IST values.
 * Example: "11:35 PM"
 */
export function formatTimeFromPicker(date: Date): string {
  if (isNaN(date.getTime())) return "";
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

/**
 * Formats a full datetime stamp in IST.
 * Example: "Wednesday, 15 July 2026 • 08:30 PM"
 */
export function formatDateTimeIST(date: Date): string {
  if (isNaN(date.getTime())) return "";
  const day = getDayNameIST(date);
  const datePart = formatDateIST(date);
  const timePart = formatTimeIST(date);
  return `${day}, ${datePart} • ${timePart}`;
}

/**
 * Formats an ISO string (from the API) as "DD Month YYYY".
 * Handles both "YYYY-MM-DD" and full ISO datetime strings.
 */
export function formatISOasDateIST(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  return formatDateIST(parseISODateAsIST(isoStr));
}

/**
 * Formats an ISO string (from the API) as full datetime in IST.
 * Example: "Wednesday, 15 July 2026 • 08:30 PM"
 */
export function formatISOasDateTimeIST(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  return formatDateTimeIST(parseISODateAsIST(isoStr));
}

/**
 * Returns today's date in IST as a JS Date object set to IST midnight UTC.
 */
export function todayInIST(): Date {
  const isoStr = todayISOinIST();
  return parseISODateAsIST(isoStr);
}

/**
 * Returns tomorrow's date in IST as a JS Date object.
 */
export function tomorrowInIST(): Date {
  const today = todayInIST();
  return new Date(today.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Formats the date label shown on the student/admin home header.
 * Input: YYYY-MM-DD string from the API.
 * Output: "Wednesday, 15 July 2026"
 */
export function formatHomeDate(isoDateStr: string): string {
  if (!isoDateStr) return "";
  const d = parseISODateAsIST(isoDateStr);
  const day = getDayNameIST(d);
  const datePart = formatDateIST(d);
  return `${day}, ${datePart}`;
}

/**
 * Returns a short relative label: "Today" or "Tomorrow" or the date.
 */
export function formatRelativeDateIST(isoDateStr: string): string {
  const todayStr = todayISOinIST();
  const tomorrowStr = (() => {
    const t = todayInIST();
    const tm = new Date(t.getTime() + 86400000);
    const istMs = tm.getTime() + IST_OFFSET_MS;
    const d = new Date(istMs);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  })();
  const dateOnly = isoDateStr.slice(0, 10);
  if (dateOnly === todayStr) return "Today";
  if (dateOnly === tomorrowStr) return "Tomorrow";
  return formatISOasDateIST(isoDateStr);
}
