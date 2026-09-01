/**
 * IST (Indian Standard Time) Date Utilities — Asia/Kolkata (Tamil Nadu, India, UTC +05:30)
 *
 * ALL user-facing date/time display must go through these helpers.
 * Dates are dynamically calculated using Asia/Kolkata (UTC+05:30) exclusively.
 * No hardcoded dates, no fixed dates, no device/server timezone dependency.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

/**
 * Returns the current IST (Tamil Nadu) time as a Date whose UTC fields represent IST values.
 * This allows getUTCHours(), getUTCDate(), getUTCMonth(), getUTCFullYear(), getUTCDay()
 * to reliably return exact Tamil Nadu values regardless of device or server timezone.
 */
export function nowIST(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/**
 * Returns the current date in Tamil Nadu (IST) as a YYYY-MM-DD string.
 * Dynamically computed — updates every day at midnight IST.
 */
export function todayISOinIST(): string {
  const ist = nowIST();
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns tomorrow's date in Tamil Nadu (IST) as a YYYY-MM-DD string.
 */
export function tomorrowISOinIST(): string {
  const d = tomorrowInIST();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parses an ISO date string (YYYY-MM-DD or full ISO) and returns a Date
 * object whose UTC fields represent the exact date/time in Tamil Nadu (IST).
 */
export function parseISODateAsIST(isoStr: string | null | undefined): Date {
  if (!isoStr) return new Date(NaN);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoStr);
  if (isDateOnly) {
    const parts = isoStr.split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0));
  }
  const epoch = new Date(isoStr).getTime();
  if (isNaN(epoch)) return new Date(NaN);
  return new Date(epoch + IST_OFFSET_MS);
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
 * Example: "01 September 2026"
 */
export function formatDateIST(date: Date): string {
  if (isNaN(date.getTime())) return "";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Returns the full day name for an IST Date object.
 * Example: "Tuesday"
 */
export function getDayNameIST(date: Date): string {
  if (isNaN(date.getTime())) return "";
  return DAY_NAMES[date.getUTCDay()];
}

/**
 * Formats time in 12-hour IST format from an API/ISO-sourced Date.
 * Example: "11:40 AM"
 */
export function formatTimeIST(date: Date): string {
  if (isNaN(date.getTime())) return "";
  let hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

/**
 * Formats time in 12-hour IST format from a DateTimePicker Date.
 * Example: "11:40 AM"
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
 * Formats a full datetime stamp in IST (Tamil Nadu time).
 * Example: "Tuesday, 01 September 2026 • 11:40 AM"
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
 * Example: "Tuesday, 01 September 2026 • 11:40 AM"
 */
export function formatISOasDateTimeIST(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  return formatDateTimeIST(parseISODateAsIST(isoStr));
}

/**
 * Returns today's date in IST as a JS Date object set to IST midnight UTC.
 */
export function todayInIST(): Date {
  return parseISODateAsIST(todayISOinIST());
}

/**
 * Returns tomorrow's date in IST as a JS Date object.
 */
export function tomorrowInIST(): Date {
  const today = todayInIST();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow;
}

/**
 * Formats the date label shown on the student/admin home header.
 * Dynamically resolves "today" / "tomorrow" or formats any given ISO date string.
 * Output: "Tuesday, 01 September 2026"
 */
export function formatHomeDate(isoDateStr?: string | null, forDay?: "today" | "tomorrow"): string {
  let targetIso: string;
  if (forDay === "tomorrow") {
    targetIso = tomorrowISOinIST();
  } else if (forDay === "today" || !isoDateStr) {
    targetIso = todayISOinIST();
  } else {
    targetIso = isoDateStr.slice(0, 10);
  }
  const d = parseISODateAsIST(targetIso);
  const day = getDayNameIST(d);
  const datePart = formatDateIST(d);
  return `${day}, ${datePart}`;
}

/**
 * Returns a short relative label: "Today" or "Tomorrow" or the formatted date.
 */
export function formatRelativeDateIST(isoDateStr: string): string {
  const dateOnly = (isoDateStr || "").slice(0, 10);
  const todayStr = todayISOinIST();
  const tomorrowStr = tomorrowISOinIST();
  if (dateOnly === todayStr) return "Today";
  if (dateOnly === tomorrowStr) return "Tomorrow";
  return formatISOasDateIST(isoDateStr);
}

/**
 * Returns the current active meal type based on Tamil Nadu (IST) time:
 * - Breakfast: 00:00 – 10:30
 * - Lunch: 10:30 – 15:30
 * - Dinner: 15:30 onwards
 */
export function getCurrentMealIST(): "breakfast" | "lunch" | "dinner" {
  const ist = nowIST();
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes < 630) return "breakfast";
  if (totalMinutes < 930) return "lunch";
  return "dinner";
}
