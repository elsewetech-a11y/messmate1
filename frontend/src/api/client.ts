// API client for MessMate backend.

import { Platform } from 'react-native';

export const CANDIDATE_URLS: string[] = [
  (process.env.EXPO_PUBLIC_BACKEND_URL || "").trim(),
  "https://messmate1-backend.onrender.com",
  ...(__DEV__ && Platform.OS === "android" ? ["http://10.0.2.2:8000", "http://127.0.0.1:8000"] : []),
].filter(Boolean).filter(u => !u.includes("trycloudflare.com")).map(u => u.replace(/\/api\/?$/i, "").replace(/\/+$/, ""));

function getInitialBaseUrl(): string {
  let rawUrl = (process.env.EXPO_PUBLIC_BACKEND_URL || "").trim();
  if (!rawUrl || rawUrl.includes("trycloudflare.com")) {
    rawUrl = "https://messmate1-backend.onrender.com";
  }
  rawUrl = rawUrl.replace(/\/api\/?$/i, "").replace(/\/+$/, "");

  if (__DEV__ && Platform.OS === "android") {
    if (rawUrl.includes("localhost")) {
      rawUrl = rawUrl.replace("localhost", "10.0.2.2");
    } else if (rawUrl.includes("127.0.0.1")) {
      rawUrl = rawUrl.replace("127.0.0.1", "10.0.2.2");
    }
  }
  return rawUrl;
}

let BASE_URL = getInitialBaseUrl();

export function setApiBaseUrl(url: string) {
  BASE_URL = url.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  return BASE_URL;
}

export type ApprovalStatus = "pending" | "approved" | "blocked";
export type Role = "student" | "admin";
export type MealStatus = "ON" | "OFF";
export type MealType = "breakfast" | "lunch" | "dinner";
export type Reaction = "like" | "dislike" | "no_response";
export type Unit = "pieces" | "grams" | "kg" | "ml" | "litres";

export type SubscriptionStatus = "TRIAL_ACTIVE" | "ACTIVE" | "TRIAL_EXPIRED" | "SUBSCRIPTION_EXPIRED" | "PAYMENT_PENDING" | "SUSPENDED";

export type SubscriptionPublic = {
  institution_or_hostel_name: string;
  status: SubscriptionStatus;
  is_trial: boolean;
  days_remaining: number;
  expiry_date?: string;
  student_limit: number;
  registered_students: number;
  plan_type?: "monthly" | "yearly";
  auto_renew?: boolean;
  communication_preferences?: CommunicationPreferences;
};

export type SubscriptionEventPublic = {
  id: string;
  institution_or_hostel_name: string;
  event_type: string;
  event_date: string;
  details: any;
};

export type UpgradeOrderRequest = {
  additional_students: number;
};

export type OrderCreateRequest = {
  plan_type: "monthly" | "yearly";
  student_count: number;
};

export type OrderCreateResponse = {
  order_id: string;
  amount: number;
  currency: string;
};

export type PaymentVerifyRequest = {
  order_id: string;
  payment_id: string;
  signature: string;
};

export type TransactionPublic = {
  id: string;
  institution_or_hostel_name: string;
  admin_id?: string | null;
  order_id: string;
  payment_id: string | null;
  provider: string;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  transaction_date: string | null;
  plan_type: string;
  student_count: number;
  error_message?: string | null;
  action?: string | null;
};

export type NotificationPublic = {
  id: string;
  institution_or_hostel_name: string;
  admin_id?: string | null;
  category: "TRIAL" | "SUBSCRIPTION" | "PAYMENT" | "CAPACITY" | "SYSTEM" | "SECURITY";
  title: string;
  description: string;
  created_at: string;
  read_status: boolean;
  action_url?: string | null;
};

export type BillingContact = {
  name: string;
  email: string;
  phone_number: string;
  designation: string;
};

export type CommunicationPreferences = {
  email_notifications: boolean;
  push_notifications: boolean;
  capacity_alerts: boolean;
  renewal_reminders: boolean;
  payment_confirmations: boolean;
  invoice_emails: boolean;
};

export type InvoicePublic = {
  id: string;
  invoice_number: string;
  institution_or_hostel_name: string;
  amount: number;
  tax: number;
  status: string;
  created_at: string;
  plan_type: string;
  student_count: number;
  subscription_period: string;
  payment_date: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user: User;
};

export type User = {
  id: string;
  full_name: string;
  email: string;
  mobile_or_user_id?: string | null;
  institution_or_hostel_name: string;
  room_number?: string | null;
  role: Role;
  approval_status: ApprovalStatus;
  email_verified?: boolean;
  created_at: string;
  updated_at: string;
  department?: string;
  academic_year?: string;
  roll_number?: string;
};

export type CustomQuestion = { text: string; options: string[] } | null;

export type MealPlan = {
  status: MealStatus | null;
  selected_items: string[];
  reason_if_off: string | null;
  custom_answer: string | null;
};

export type DailyMenu = {
  day: string;
  breakfast_items: string[];
  lunch_items: string[];
  dinner_items: string[];
  breakfast_custom_question: CustomQuestion;
  lunch_custom_question: CustomQuestion;
  dinner_custom_question: CustomQuestion;
};

export type DayMenu = DailyMenu;

export type WeeklyDay = DailyMenu & {
  reactions: { breakfast: Reaction; lunch: Reaction; dinner: Reaction };
};

export type TodayResponse = {
  date: string;
  day: string;
  for?: "today" | "tomorrow";
  menu: DailyMenu | null;
  plan: {
    date: string;
    breakfast: Partial<MealPlan>;
    lunch: Partial<MealPlan>;
    dinner: Partial<MealPlan>;
    updated_at?: string;
  } | null;
};

export type WastageSummary = {
  today: {
    breakfast: number | null;
    lunch: number | null;
    dinner: number | null;
    total: number | null;
  };
  yesterday_total: number | null;
  last_week_same_day_total: number | null;
};

export type WastageResponse = {
  range: number;
  meal: "all" | MealType;
  series: { date: string; value: number }[];
  summary: WastageSummary;
};

// ---------- Admin types ----------
export type StudentsSummary = {
  total_students: number;
  approved: number;
  pending: number;
  blocked: number;
};

export type StudentRow = {
  id: string;
  full_name: string;
  email?: string;
  mobile_or_user_id: string;
  institution_or_hostel_name: string;
  room_number?: string | null;
  role: Role;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
  department?: string;
  academic_year?: string;
  roll_number?: string;
};

export type MealStat = {
  menu_items: string[];
  custom_question: CustomQuestion;
  eating_count: number;
  not_eating_count: number;
  like_count: number;
  dislike_count: number;
  like_pct: number | null;
  dislike_pct: number | null;
  item_counts: { item_name: string; count: number }[];
  reason_counts: { reason: string; count: number }[];
  custom_answer_counts: { answer: string; count: number }[];
};

export type AdminTodayResponse = {
  date: string;
  day: string;
  total_responses: number;
  breakfast: MealStat;
  lunch: MealStat;
  dinner: MealStat;
};

export type DashboardItem = {
  item_name: string;
  preference_count: number;
  quantity_per_person: number | null;
  unit: Unit | null;
  suggested: number | null;
  display: { value: number; unit: string } | null;
};

export type DashboardMeal = {
  menu_items: string[];
  eating_count: number;
  not_eating_count: number;
  items: DashboardItem[];
  warnings: string[];
};

export type DashboardResponse = {
  date: string;
  day: string;
  for?: "today" | "tomorrow";
  meals: { breakfast: DashboardMeal; lunch: DashboardMeal; dinner: DashboardMeal };
  summary: {
    breakfast_eating: number;
    lunch_eating: number;
    dinner_eating: number;
    total_responses: number;
    most_demanded: { item: string; count: number } | null;
    least_demanded: { item: string; count: number } | null;
  };
};

export type MealSummary = {
  on_count: number;
  off_count: number;
  no_response_count: number;
  items: {
    item_name: string;
    planned_qty: number;
    suggested_qty: number;
    buffer_pct: number;
    unit: Unit;
  }[];
};

export type AdminStudent = {
  id: string;
  full_name: string;
  email: string;
  mobile_or_user_id?: string;
  institution_or_hostel_name: string;
  role: Role;
  approval_status: ApprovalStatus;
  room_number?: string | null;
  department?: string | null;
  academic_year?: string | null;
  roll_number?: string | null;
  created_at?: string;
  plan_today?: {
    breakfast?: Partial<MealPlan> | null;
    lunch?: Partial<MealPlan> | null;
    dinner?: Partial<MealPlan> | null;
  } | null;
};

export type NecessaryItem = {
  id: string;
  item_name: string;
  meal_type: MealType;
  quantity_per_person: number;
  unit: Unit;
  price_per_unit: number;
  price_unit: Unit;
  updated_at?: string;
};

export type WastageDocFull = {
  id: string;
  date: string;
  breakfast_items: any[];
  lunch_items: any[];
  dinner_items: any[];
  breakfast_wastage_kg: number;
  lunch_wastage_kg: number;
  dinner_wastage_kg: number;
  breakfast_loss?: number;
  lunch_loss?: number;
  dinner_loss?: number;
  total_loss?: number;
  manual_total_cost?: number | null;
  item_loss_total?: number;
};

export type AdminWastageToday = {
  date: string;
  today: WastageDocFull | null;
  yesterday: WastageDocFull | null;
  last_week_same_day: WastageDocFull | null;
  average_loss_30d: number | null;
  saved_amount_vs_avg: number | null;
};

export type ScheduledNotification = {
  id: string;
  title: string;
  message: string;
  notificationType: "Daily" | "Weekly" | "One Time";
  scheduledTime: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalRecipients: number;
    delivered: number;
    failed: number;
  };
};

export type AdminWastageTrend = {
  range: number;
  meal: "all" | MealType;
  wastage_series: { date: string; value: number }[];
  saved_series: { date: string; value: number }[];
};

export type AppSettings = {
  id: string;
  default_meal_state: "ON" | "OFF";
  default_like_dislike_state: Reaction;
  default_preference_state: "none" | "all" | "previous";
  notifications_enabled: boolean;
  language: string;
  updated_at?: string;
};

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// --- Session invalidation handling ---
let sessionInvalidatedHandler: ((message: string) => void) | null = null;
let sessionInvalidatedFiring = false;

export function setSessionInvalidatedHandler(
  h: ((message: string) => void) | null,
) {
  sessionInvalidatedHandler = h;
}

function maybeFireSessionInvalidated(status: number, data: any) {
  if (status !== 401) return;
  const detail = data && data.detail;
  const code =
    detail && typeof detail === "object" ? detail.code : undefined;
  if (code !== "session_invalidated") return;
  if (sessionInvalidatedFiring) return;
  sessionInvalidatedFiring = true;
  try {
    const msg =
      (detail && typeof detail === "object" && detail.message) ||
      "You've been signed out because this account was signed in on another device.";
    sessionInvalidatedHandler?.(msg);
  } finally {
    setTimeout(() => {
      sessionInvalidatedFiring = false;
    }, 1500);
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: any;
    token?: string | null;
    timeoutMs?: number;
    retries?: number;
  } = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    token,
    timeoutMs = 25000,
    retries = 2,
  } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "bypass-tunnel-reminder": "true",
    "ngrok-skip-browser-warning": "true",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const finalPath = path.startsWith("/api") ? path : `/api${path}`;

  let res: Response | null = null;
  let activeUrl = BASE_URL;
  let lastErr: any = null;

  const isRetryable = (response: Response | null, err: any) => {
    if (err) return true;
    if (!response) return true;
    return (
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504 ||
      response.status === 530
    );
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    lastErr = null;
    res = null;

    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const effectiveTimeout = attempt === 0 ? timeoutMs : Math.min(timeoutMs, 18000);
      const timeoutId = controller ? setTimeout(() => controller.abort(), effectiveTimeout) : null;

      try {
        res = await fetch(`${activeUrl}${finalPath}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller ? controller.signal : undefined,
        });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`[API] Attempt ${attempt + 1}/${retries + 1} on ${activeUrl}${finalPath} failed:`, err?.message || err);
    }

    if (res && !isRetryable(res, null)) {
      break;
    }

    if (attempt < retries) {
      const backoffMs = Math.min(1000 * Math.pow(1.5, attempt), 2500);
      console.log(`[API] Retrying ${finalPath} in ${backoffMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  // If primary candidate failed after retries, probe other candidate URLs
  if (!res || isRetryable(res, lastErr)) {
    for (const candidate of CANDIDATE_URLS) {
      if (candidate === activeUrl) continue;
      try {
        const cCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const cTimeout = cCtrl ? setTimeout(() => cCtrl.abort(), 6000) : null;
        try {
          const testRes = await fetch(`${candidate}${finalPath}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: cCtrl ? cCtrl.signal : undefined,
          });
          if (testRes && (!isRetryable(testRes, null) || testRes.ok)) {
            BASE_URL = candidate;
            activeUrl = candidate;
            res = testRes;
            lastErr = null;
            console.log(`[API] Successfully switched to active server: ${BASE_URL}`);
            break;
          }
        } finally {
          if (cTimeout) clearTimeout(cTimeout);
        }
      } catch {
        // Continue to next candidate
      }
    }
  }

  if (!res) {
    throw new ApiError(
      `Unable to connect to backend server. Please check your internet connection and try again.`,
      0,
      null
    );
  }

  
  let text = "";
  try {
    text = await res.text();
  } catch (readErr) {
    console.error(`[API Error] Failed to read response body for ${finalPath}:`, readErr);
    throw new ApiError("Failed to read server response.", res.status || 500, null);
  }

  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.warn(`[API Warning] Non-JSON response for ${finalPath} (Status ${res.status}):`, text.slice(0, 200));
      data = { raw: text, message: text.length < 200 ? text : undefined };
    }
  }
  
  console.log(`[API Response] ${method} ${activeUrl}${finalPath} - Status: ${res.status}`, data);

  if (!res.ok) {
    const detail = data && (data.detail || data.message || (typeof data === "string" ? data : null));
    
    console.error(`[API Error] ${method} ${activeUrl}${finalPath} - Status: ${res.status} - Detail:`, detail);

    
    let msg = `Something went wrong. Please try again later.`;
    
    if (res.status === 401) {
      msg = typeof detail === "string" ? detail : "Session expired or authentication failed. Please sign in again.";
    } else if (res.status === 403) {
      if (typeof detail === "string") {
        msg = detail;
      } else if (detail && typeof detail === "object" && detail.message) {
        msg = detail.message;
      } else {
        msg = "Access restricted. You do not have permission for this action.";
      }
    } else if (res.status === 404) {
      msg = "The requested information could not be found.";
    } else if (res.status === 408 || res.status === 504) {
      msg = "Server gateway timed out. Please try again.";
    } else if (res.status === 422) {
      if (Array.isArray(detail)) {
        msg = detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(", ");
      } else if (typeof detail === "string") {
        msg = detail;
      } else {
        msg = "Invalid input provided. Please check your data and try again.";
      }
    } else if (res.status === 502 || res.status === 503) {
      msg = "Backend server is currently unavailable. Please check the server status.";
    } else if (res.status >= 400 && res.status < 500) {
      if (typeof detail === "string") {
        msg = detail;
      } else if (detail && typeof detail === "object" && detail.message) {
        msg = detail.message;
      } else {
        msg = "Unable to complete your request at this time.";
      }
    } else if (res.status >= 500) {
      if (typeof detail === "string" && !detail.toLowerCase().includes("traceback")) {
        msg = detail;
      } else {
        msg = "Internal server error occurred. Please try again later.";
      }
    }
    
    maybeFireSessionInvalidated(res.status, data);
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, options: { token?: string | null; headers?: Record<string, string> } = {}): Promise<T> => {
    const token = options?.token || (options?.headers?.Authorization?.replace(/^Bearer\s+/i, ""));
    return request<T>(path, { method: "GET", token });
  },
  post: <T>(path: string, body?: any, options: { token?: string | null; headers?: Record<string, string> } = {}): Promise<T> => {
    const token = options?.token || (options?.headers?.Authorization?.replace(/^Bearer\s+/i, ""));
    return request<T>(path, { method: "POST", body, token });
  },
  put: <T>(path: string, body?: any, options: { token?: string | null; headers?: Record<string, string> } = {}): Promise<T> => {
    const token = options?.token || (options?.headers?.Authorization?.replace(/^Bearer\s+/i, ""));
    return request<T>(path, { method: "PUT", body, token });
  },
  delete: <T>(path: string, options: { token?: string | null; headers?: Record<string, string> } = {}): Promise<T> => {
    const token = options?.token || (options?.headers?.Authorization?.replace(/^Bearer\s+/i, ""));
    return request<T>(path, { method: "DELETE", token });
  },
  applyCoupon: (token: string, payload: { coupon_code: string }): Promise<{ ok: boolean; message: string }> =>
    request("/api/subscription/apply-coupon", { token, method: "POST", body: payload }),
  refreshToken: (payload: { refresh_token: string }): Promise<TokenResponse> => request("/api/auth/refresh", { method: "POST", body: payload }),
  getSubscriptionStatus: (token: string): Promise<SubscriptionPublic> => request("/api/subscription/status", { token }),
  getStudentSubscriptionStatus: (token: string): Promise<SubscriptionPublic> => request("/api/student/subscription/status", { token }),
  renewSubscription: (token: string): Promise<{success: boolean; message: string}> => request("/api/subscription/renew", { token, method: "POST" }),
  createSubscriptionOrder: (token: string, payload: OrderCreateRequest): Promise<OrderCreateResponse> => request("/api/subscription/order", { token, method: "POST", body: payload }),
  verifyPayment: (token: string, payload: PaymentVerifyRequest): Promise<{success: boolean; message: string}> => request("/api/subscription/verify-payment", { token, method: "POST", body: payload }),
  reportPaymentFailed: (token: string, payload: { order_id: string; error_message: string; payment_id?: string }): Promise<{success: boolean}> => request("/api/subscription/payment-failed", { token, method: "POST", body: payload }),
  toggleAutoRenew: (token: string, payload: { enabled: boolean }): Promise<{success: boolean; auto_renew: boolean}> => request("/api/subscription/auto-renew", { token, method: "PUT", body: payload }),
  getPaymentHistory: (token: string): Promise<TransactionPublic[]> => request("/api/subscription/transactions", { token }),
  getInvoices: (token: string): Promise<InvoicePublic[]> => request("/api/subscription/invoices", { token }),
  getSubscriptionEvents: (token: string): Promise<SubscriptionEventPublic[]> => request("/api/subscription/events", { token }),
  createUpgradeOrder: (token: string, payload: UpgradeOrderRequest): Promise<OrderCreateResponse> => request("/api/subscription/upgrade-order", { token, method: "POST", body: payload }),
  getNotifications: (token: string): Promise<NotificationPublic[]> => request("/api/notifications", { token }),
  markNotificationRead: (token: string, notificationId: string): Promise<{success: boolean}> => request(`/api/notifications/${notificationId}/read`, { token, method: "PUT" }),
  updateCommunicationPreferences: (token: string, payload: CommunicationPreferences): Promise<{success: boolean}> => request("/api/subscription/preferences", { token, method: "PUT", body: payload }),
  updateBillingContact: (token: string, payload: BillingContact): Promise<{success: boolean}> => request("/api/subscription/billing-contact", { token, method: "PUT", body: payload }),
  // Auth — email OTP
  register: (payload: {
    full_name: string;
    email: string;
    password: string;
    confirm_password: string;
    institution_or_hostel_name: string;
    role?: "student" | "admin";
    department?: string;
    academic_year?: string;
    roll_number?: string;
    room_number?: string;
  }) =>
    request<{
      status: "verification_required";
      email: string;
      resend_available_in: number;
      expires_in: number;
      dev_otp?: string;
    }>("/auth/register", { method: "POST", body: payload }),
  verifyEmail: (payload: { email: string; otp: string }) =>
    request<TokenResponse | { status: string; email: string }>("/auth/verify-email", { method: "POST", body: payload }),
  login: (payload: { email: string; password: string }) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: payload }),
  resendOtp: (payload: { email: string; purpose: "registration" | "forgot_password" }) =>
    request<{ status: string; resend_available_in: number; expires_in: number; dev_otp?: string }>(
      "/auth/resend-otp",
      { method: "POST", body: payload },
    ),
  forgotPassword: (payload: { email: string }) =>
    request<{ status: string; resend_available_in: number; expires_in: number; dev_otp?: string }>(
      "/auth/forgot-password",
      { method: "POST", body: payload },
    ),
  forgotPasswordVerify: (payload: { email: string; otp: string }) =>
    request<{ reset_token: string; expires_in: number }>(
      "/auth/forgot-password/verify",
      { method: "POST", body: payload },
    ),
  resetPassword: (payload: {
    reset_token: string;
    new_password: string;
    confirm_password: string;
  }) =>
    request<TokenResponse>("/auth/reset-password", {
      method: "POST",
      body: payload,
    }),
  savePushToken: (
    token: string,
    payload: { push_token: string; platform?: "ios" | "android" | "web" },
  ) =>
    request<{ ok: boolean }>("/auth/push-token", {
      method: "POST",
      body: payload,
      token,
    }),
  registerPush: (
    token: string,
    payload: { user_id: string; platform: "ios" | "android" | "web"; device_token: string },
  ) =>
    request<{ status: string }>("/register-push", {
      method: "POST",
      body: payload,
      token,
    }),
  me: (token: string) => request<User>("/auth/me", { token }),
  changePassword: (token: string, payload: any) =>
    request<{ ok: boolean }>("/auth/change-password", {
      method: "POST",
      body: payload,
      token,
    }),

  // Student
  studentMeta: (token: string) =>
    request<{ reasons: string[]; days: string[] }>("/student/meta", { token }),
  studentToday: (token: string, forDay: "today" | "tomorrow" = "today") =>
    request<TodayResponse>(`/student/today?for=${forDay}`, { token }),
  upsertToday: (
    token: string,
    body: {
      date?: string | null;
      breakfast: Partial<MealPlan>;
      lunch: Partial<MealPlan>;
      dinner: Partial<MealPlan>;
    },
  ) =>
    request<{ ok: boolean; plan: TodayResponse["plan"] }>("/student/today", {
      method: "PUT",
      body,
      token,
    }),
  postFeedback: (token: string, feedback_text: string) =>
    request<{ ok: boolean; id: string; created_at: string }>("/student/feedback", {
      method: "POST",
      body: { feedback_text },
      token,
    }),
  menuWeek: (token: string) =>
    request<{ days: WeeklyDay[] }>("/student/menu/week", { token }),
  menuMonth: (token: string) =>
    request<{ weeks: { label: string; days: WeeklyDay[] }[] }>("/student/menu/month", {
      token,
    }),
  setReaction: (
    token: string,
    body: { day: string; meal_type: MealType; reaction: Reaction },
  ) =>
    request<{ ok: boolean; reaction: Reaction }>("/student/menu/reaction", {
      method: "PUT",
      body,
      token,
    }),
  wastage: (token: string, range: 7 | 30 | 90, meal: "all" | MealType) =>
    request<WastageResponse>(`/student/wastage?range=${range}&meal=${meal}`, { token }),

  // Admin
  adminStudentsSummary: (token: string) =>
    request<StudentsSummary>("/admin/students/summary", { token }),
  adminStudentsList: (
    token: string,
    status: "all" | "pending" | "approved" | "blocked" = "all",
  ) =>
    request<{ students: StudentRow[]; count: number }>(
      `/admin/students?status=${status}`,
      { token },
    ),
  adminApprove: (token: string, id: string) =>
    request<{ ok: boolean; status?: string; message?: string }>(`/admin/students/${id}/approve`, {
      method: "POST",
      token,
    }),
  adminReject: (token: string, id: string) =>
    request<{ ok: boolean }>(`/admin/students/${id}/reject`, {
      method: "POST",
      token,
    }),
  adminBlock: (token: string, id: string) =>
    request<{ ok: boolean; message?: string }>(`/admin/students/${id}/block`, {
      method: "POST",
      token,
    }),
  adminRemove: (token: string, id: string) =>
    request<{ ok: boolean; message?: string }>(`/admin/students/${id}/remove`, {
      method: "POST",
      token,
    }),
  adminToday: (token: string) =>
    request<AdminTodayResponse>("/admin/today", { token }),
  adminFeedback: (token: string, days: number = 7) =>
    request<{
      items: { id: string; date: string; feedback_text: string; created_at: string }[];
      count: number;
    }>(`/admin/feedback?days=${days}`, { token }),
  adminDashboard: (token: string, forDay: "today" | "tomorrow" = "today") =>
    request<DashboardResponse>(`/admin/dashboard?for=${forDay}`, { token }),

  adminNecessaryInfo: (token: string) =>
    request<{ items: NecessaryItem[]; count: number }>("/admin/necessary-info", {
      token,
    }),
  adminNiCreate: (token: string, body: Omit<NecessaryItem, "id" | "updated_at">) =>
    request<NecessaryItem>("/admin/necessary-info", {
      method: "POST",
      body,
      token,
    }),
  adminNiUpdate: (
    token: string,
    id: string,
    body: Omit<NecessaryItem, "id" | "updated_at">,
  ) =>
    request<NecessaryItem>(`/admin/necessary-info/${id}`, {
      method: "PUT",
      body,
      token,
    }),
  adminNiDelete: (token: string, id: string) =>
    request<{ ok: boolean }>(`/admin/necessary-info/${id}`, {
      method: "DELETE",
      token,
    }),

  adminMenuList: (token: string) =>
    request<{ days: DailyMenu[] }>("/admin/menus", { token }),
  adminMenuUpsert: (
    token: string,
    day: string,
    body: {
      breakfast_items: string[];
      lunch_items: string[];
      dinner_items: string[];
      breakfast_custom_question: CustomQuestion;
      lunch_custom_question: CustomQuestion;
      dinner_custom_question: CustomQuestion;
    },
  ) => request<DailyMenu>(`/admin/menus/${day}`, { method: "PUT", body, token }),

  adminWastageToday: (token: string) =>
    request<AdminWastageToday>("/admin/wastage/today", { token }),
  adminWastageTrend: (
    token: string,
    range: 7 | 30 | 90,
    meal: "all" | MealType,
  ) =>
    request<AdminWastageTrend>(
      `/admin/wastage/trend?range=${range}&meal=${meal}`,
      { token },
    ),
  adminWastageUpsert: (
    token: string,
    target_date: string,
    body: {
      breakfast_items: { item_name: string; quantity: number; unit: Unit }[];
      lunch_items: { item_name: string; quantity: number; unit: Unit }[];
      dinner_items: { item_name: string; quantity: number; unit: Unit }[];
      manual_total_cost?: number;
    },
  ) =>
    request<{ ok: boolean; wastage: WastageDocFull }>(
      `/admin/wastage/${target_date}`,
      { method: "PUT", body, token },
    ),

  adminSettings: (token: string) =>
    request<AppSettings>("/admin/settings", { token }),
  adminSettingsUpdate: (token: string, body: Partial<AppSettings>) =>
    request<{ status: string; id: string }>("/admin/settings", { method: "PUT", body: body, token }),
  
  // Admin — Notifications

  // Notifications
  studentNotifications: (token: string) =>
    request<{
      unread_count: number;
      items: {
        id: string;
        title: string;
        message: string;
        date: string;
        day: string;
        time: string;
        created_at: string;
        read_status: boolean;
      }[];
    }>("/student/notifications", { token }),
  markStudentNotifRead: (token: string, id: string) =>
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
    request<{ ok: boolean }>("/student/notifications/clear", {
      method: "POST",
      token,
    }),
  getNotificationSettings: (token: string) =>
    request<any>("/student/notification-settings", { token }),
  updateNotificationSettings: (token: string, payload: any) =>
    request<{ ok: boolean }>("/student/notification-settings", {
      method: "POST",
      body: payload,
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
};

export const client = api;
export default api;
