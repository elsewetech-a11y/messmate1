"""MessMate backend — Auth + Student + Admin + Notifications.

Multi-tenant: every domain doc is scoped by `hostel` (institution_or_hostel_name).
Two-step login with mocked OTP. In-app notifications + push token capture.
"""

from security import rate_limit
from email.utils import formataddr as _formataddr
from email.message import EmailMessage as _EmailMessage
import base64 as _base64
import re as _re
import asyncio
import logging
import os
import secrets
import uuid

import razorpay
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID else None

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import time

from logger import logger


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
IST = timezone(timedelta(hours=5, minutes=30))
# Setup
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "10080"))

# SMTP Email
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "") or "587")
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("SMTP_PASS", "").strip()
FROM_EMAIL = os.environ.get("FROM_EMAIL", "").strip()
FROM_NAME = os.environ.get("FROM_NAME", "MessMate").strip() or "MessMate"
GMAIL_CLIENT_ID = os.environ.get("GMAIL_CLIENT_ID", "").strip()
GMAIL_CLIENT_SECRET = os.environ.get("GMAIL_CLIENT_SECRET", "").strip()
GMAIL_REFRESH_TOKEN = os.environ.get("GMAIL_REFRESH_TOKEN", "").strip()
GMAIL_CONFIGURED = all([GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, FROM_EMAIL])

# OTP config
OTP_LENGTH = int(os.environ.get("OTP_LENGTH", "6"))
OTP_EXPIRY_MIN = int(os.environ.get("OTP_EXPIRY_MIN", "5"))
OTP_RESEND_INTERVAL_SEC = int(os.environ.get("OTP_RESEND_INTERVAL_SEC", "60"))
OTP_MAX_VERIFY_ATTEMPTS = int(os.environ.get("OTP_MAX_VERIFY_ATTEMPTS", "5"))
RESET_TOKEN_EXPIRY_MIN = int(os.environ.get("RESET_TOKEN_EXPIRY_MIN", "10"))

# Emergent Push Notifications
EMERGENT_PUSH_BASE_URL = "https://integrations.emergentagent.com"
EMERGENT_PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
users_col = db["users"]
menus_col = db["menus"]
daily_plans_col = db["daily_plans"]
menu_reactions_col = db["menu_reactions"]
feedback_col = db["feedback"]
wastage_col = db["wastage_records"]
necessary_info_col = db["necessary_info"]
settings_col = db["app_settings"]
notifications_col = db["notifications"]
admin_notifications_col = db["admin_notifications"]
student_notifications_col = db["student_notifications"]
scheduled_notifications_col = db["scheduled_notifications"]
notification_logs_col = db["notification_logs"]
email_otps_col = db["email_otps"]
push_tokens_col = db["push_tokens"]
pending_requests_col = db["pending_requests"]
subscriptions_col = db["subscriptions"]
payments_col = db["payments"]
subscription_events_col = db["subscription_events"]
transactions_col = db["transactions"]
invoices_col = db["invoices"]
communication_logs_col = db["communication_logs"]
activity_logs_col = db["activity_logs"]
audit_logs_col = db["audit_logs"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login", auto_error=False)

# Shared async HTTP client (push relay).
_push_client: Optional[httpx.AsyncClient] = None


def get_push_client() -> httpx.AsyncClient:
    global _push_client
    if _push_client is None:
        _push_client = httpx.AsyncClient(
            base_url=EMERGENT_PUSH_BASE_URL,
            headers={"X-Push-Key": EMERGENT_PUSH_KEY},
            timeout=10.0,
        )
    return _push_client


app = FastAPI(title="MessMate API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("messmate")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
Role = Literal["student", "admin"]
ApprovalStatus = Literal["pending", "approved", "blocked"]
MealStatus = Literal["ON", "OFF"]
MealType = Literal["breakfast", "lunch", "dinner"]
Reaction = Literal["like", "dislike", "no_response"]
Unit = Literal["pieces", "grams", "kg", "ml", "litres"]
SubscriptionStatus = Literal["TRIAL_ACTIVE",
                             "ACTIVE",
                             "TRIAL_EXPIRED",
                             "SUBSCRIPTION_EXPIRED",
                             "PAYMENT_PENDING",
                             "SUSPENDED"]


class BillingContact(BaseModel):
    name: str
    designation: str
    email: str
    phone_number: str


class SubscriptionPublic(BaseModel):
    institution_or_hostel_name: str
    status: SubscriptionStatus
    is_trial: bool
    days_remaining: int
    expiry_date: Optional[str] = None
    student_limit: int
    registered_students: int
    billing_contact: Optional[BillingContact] = None
    plan_type: Optional[str] = None
    auto_renew: bool = False


class SubscriptionEventPublic(BaseModel):
    id: str
    institution_or_hostel_name: str
    event_type: str
    event_date: str
    details: dict


class OrderCreateRequest(BaseModel):
    plan_type: Literal["monthly", "yearly"]
    student_count: int


class OrderCreateResponse(BaseModel):
    order_id: str
    amount: float
    currency: str


class PaymentVerifyRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str


class TransactionPublic(BaseModel):
    id: str
    institution_or_hostel_name: str
    admin_id: Optional[str] = None
    order_id: str
    payment_id: Optional[str] = None
    provider: str
    amount: float
    currency: str
    status: Literal["PENDING", "SUCCESS", "FAILED"]
    transaction_date: Optional[str] = None
    plan_type: str
    student_count: int
    error_message: Optional[str] = None
    action: Optional[str] = None


class InvoicePublic(BaseModel):
    id: str
    invoice_number: str
    institution_or_hostel_name: str
    amount: float
    tax: float
    status: str
    created_at: str
    plan_type: str
    student_count: int
    subscription_period: str
    payment_date: str


class NotificationPublic(BaseModel):
    id: str
    institution_or_hostel_name: str
    admin_id: Optional[str] = None
    category: Literal["TRIAL", "SUBSCRIPTION",
                      "PAYMENT", "CAPACITY", "SYSTEM", "SECURITY"]
    title: str
    description: str
    created_at: str
    read_status: bool = False
    action_url: Optional[str] = None


class StudentNotificationPublic(BaseModel):
    id: str
    title: str
    message: str
    date: str
    time: str
    created_at: str
    read_status: bool = False


class ScheduledNotificationPublic(BaseModel):
    id: Optional[str] = None
    title: str
    message: str
    notificationType: Literal["Immediate", "Scheduled"]
    daysSelection: Optional[list[str]] = None
    scheduledTime: Optional[str] = None
    repeatOption: Optional[Literal["Send Once", "Repeat Weekly", "Repeat Every Selected Day"]] = None
    isActive: bool = True
    created_at: Optional[str] = None
    lastSentAt: Optional[str] = None


class CommunicationPreferences(BaseModel):
    email_notifications: bool = True
    push_notifications: bool = True
    capacity_alerts: bool = True
    renewal_reminders: bool = True
    payment_confirmations: bool = True
    invoice_emails: bool = True


class StudentRegisterRequest(BaseModel):
    """LEGACY — still accepted to keep old endpoints alive. Prefer /auth/register."""
    full_name: str = Field(..., min_length=1, max_length=120)
    mobile_or_user_id: str = Field(..., min_length=3, max_length=60)
    institution_or_hostel_name: str = Field(..., min_length=1, max_length=120)
    room_number: Optional[str] = Field(default=None, max_length=40)
    password: str = Field(..., min_length=6, max_length=128)
    email: Optional[str] = None


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=4, max_length=200)
    password: str = Field(..., min_length=6, max_length=128)
    confirm_password: Optional[str] = None
    institution_or_hostel_name: str = Field(..., min_length=1, max_length=120)
    role: Optional[Literal["student", "admin"]] = "student"
    department: Optional[str] = None
    academic_year: Optional[str] = None
    roll_number: Optional[str] = None
    room_number: Optional[str] = None


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=4, max_length=200)
    password: str = Field(..., min_length=1)


class VerifyEmailRequest(BaseModel):
    email: str
    otp: str = Field(..., min_length=4, max_length=10)


class ResendOtpEmailRequest(BaseModel):
    email: str
    purpose: Literal["registration", "forgot_password"] = "registration"


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=4, max_length=200)


class ForgotPasswordVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=6, max_length=128)
    confirm_password: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class NotificationSettingsPayload(BaseModel):
    push_notifications: bool
    in_app_notifications: bool
    sound: bool
    vibration: bool


class UserPublic(BaseModel):
    id: str
    full_name: str
    email: str
    mobile_or_user_id: Optional[str] = None  # legacy passthrough
    institution_or_hostel_name: str
    room_number: Optional[str] = None
    role: Role
    approval_status: ApprovalStatus
    email_verified: bool = False
    created_at: str
    updated_at: str
    department: Optional[str] = None
    academic_year: Optional[str] = None
    roll_number: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class CustomQuestion(BaseModel):
    text: str
    options: List[str]


class MealPlanInput(BaseModel):
    status: Optional[MealStatus] = None
    selected_items: List[str] = Field(default_factory=list)
    reason_if_off: Optional[str] = None
    custom_answer: Optional[str] = None


class DailyPlanUpsert(BaseModel):
    date: Optional[str] = None
    breakfast: MealPlanInput = Field(default_factory=MealPlanInput)
    lunch: MealPlanInput = Field(default_factory=MealPlanInput)
    dinner: MealPlanInput = Field(default_factory=MealPlanInput)


class ReactionUpsert(BaseModel):
    day: str
    meal_type: MealType
    reaction: Reaction


class FeedbackInput(BaseModel):
    feedback_text: str = Field(..., min_length=1, max_length=2000)


class MenuUpsert(BaseModel):
    breakfast_items: List[str] = Field(default_factory=list)
    lunch_items: List[str] = Field(default_factory=list)
    dinner_items: List[str] = Field(default_factory=list)
    breakfast_custom_question: Optional[CustomQuestion] = None
    lunch_custom_question: Optional[CustomQuestion] = None
    dinner_custom_question: Optional[CustomQuestion] = None


class NecessaryItemInput(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=80)
    meal_type: MealType
    quantity_per_person: float = Field(..., ge=0)
    unit: Unit
    price_per_unit: float = Field(..., ge=0)
    price_unit: Unit


class WastageItemInput(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=80)
    quantity: float = Field(..., ge=0)
    unit: Unit
    price_per_unit: Optional[float] = None
    price_unit: Optional[Unit] = None


class WastageUpsert(BaseModel):
    breakfast_items: List[WastageItemInput] = Field(default_factory=list)
    lunch_items: List[WastageItemInput] = Field(default_factory=list)
    dinner_items: List[WastageItemInput] = Field(default_factory=list)
    manual_total_cost: Optional[float] = None  # admin-typed daily cost (₹)


class AppSettingsInput(BaseModel):
    default_meal_state: Optional[Literal["ON", "OFF"]] = None
    default_like_dislike_state: Optional[Reaction] = None
    default_preference_state: Optional[Literal["none",
                                               "all", "previous"]] = None
    notifications_enabled: Optional[bool] = None
    language: Optional[str] = None
    # e.g. ["07:00", "11:30", "18:00"]
    reminder_times: Optional[List[str]] = None


class PushTokenInput(BaseModel):
    push_token: str = Field(..., min_length=1, max_length=600)
    platform: Optional[Literal["ios", "android", "web"]] = None


class RegisterPushBody(BaseModel):
    user_id: str
    platform: Literal["ios", "android", "web"]
    device_token: str = Field(..., min_length=4, max_length=600)


class ReminderDispatchInput(BaseModel):
    audience: Literal["student", "admin", "all"] = "student"
    title: Optional[str] = None
    body: Optional[str] = None


class NotificationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=140)
    body: str = Field(..., min_length=1, max_length=600)
    audience: Literal["all", "student"] = "all"
    recipient_id: Optional[str] = None
    type: Literal["announcement", "menu_reminder", "system"] = "announcement"
    action_url: Optional[str] = None
    # ISO date (legacy label — display only)
    scheduled_for: Optional[str] = None
    # ISO datetime — when to actually fire the push
    send_at: Optional[str] = None


class MenuReminderCreate(BaseModel):
    """Schedules tomorrow's menu reminder for all students in the hostel."""
    custom_body: Optional[str] = None


class RecurringNotificationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=140)
    message: str = Field(..., min_length=1, max_length=1000)
    notificationType: Literal["Daily", "Weekly", "One Time"] = "Daily"
    scheduledTime: str = Field(..., description="HH:MM format in 24hr")
    startDate: str = Field(..., description="YYYY-MM-DD")
    endDate: Optional[str] = Field(default=None, description="YYYY-MM-DD")


class RecurringNotificationUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=140)
    message: Optional[str] = Field(default=None, min_length=1, max_length=1000)
    notificationType: Optional[Literal["Daily", "Weekly", "One Time"]] = None
    scheduledTime: Optional[str] = Field(
        default=None, description="HH:MM format in 24hr")
    startDate: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    endDate: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    isActive: Optional[bool] = None


# Default reminder text — used to pre-fill the admin composer.
DEFAULT_REMINDER_TITLE = "Help reduce food waste — mark your meals"
DEFAULT_REMINDER_BODY = (
    "Hi! Please open MessMate and mark whether you'll be eating today's meals "
    "and pick the items you'd like. This helps the mess cook the right quantity "
    "and cut down on food waste. It only takes a few seconds — thank you for "
    "participating!")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
REASONS = [
    "Going home", "Eating outside", "Not hungry", "Class/Event",
    "Sick", "Don't like today's menu", "Other",
]
DAYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"]
DEFAULT_HOSTEL = "Demo Hostel"


def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def create_token(payload: dict, minutes: int = JWT_EXPIRE_MINUTES) -> str:
    to_encode = payload.copy()
    to_encode["exp"] = datetime.now(IST) + timedelta(minutes=minutes)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def to_public(d: dict) -> UserPublic:
    return UserPublic(
        id=d["id"],
        full_name=d["full_name"],
        email=d.get("email") or d.get("mobile_or_user_id", ""),
        mobile_or_user_id=d.get("mobile_or_user_id"),
        institution_or_hostel_name=d["institution_or_hostel_name"],
        room_number=d.get("room_number"),
        role=d["role"],
        approval_status=d["approval_status"],
        email_verified=bool(d.get("email_verified", False)),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def today_iso() -> str:
    return datetime.now(IST).date().isoformat()


def now_iso() -> str:
    return datetime.now(IST).isoformat()


def day_of_week(d: date) -> str:
    return DAYS[d.weekday()]


def to_kg_equiv(q: float, u: str) -> float:
    return {"pieces": q * 0.05, "grams": q / 1000.0, "kg": q,
            "ml": q / 1000.0, "litres": q}.get(u, q)


def normalize_to_price_unit(q: float, qu: str, pu: str) -> float:
    if qu == pu:
        return float(q)
    pairs = {("grams", "kg"): q / 1000.0, ("kg", "grams"): q * 1000.0,
             ("ml", "litres"): q / 1000.0, ("litres", "ml"): q * 1000.0}
    return pairs.get((qu, pu), float(q))


def display_quantity(v: float, u: str) -> Dict[str, Any]:
    if u == "grams" and v >= 1000:
        return {"value": round(v / 1000.0, 2), "unit": "kg"}
    if u == "ml" and v >= 1000:
        return {"value": round(v / 1000.0, 2), "unit": "litres"}
    return {"value": round(v, 2), "unit": u}


def hostel_of(user: dict) -> str:
    return user["institution_or_hostel_name"]


async def get_user_by_id(uid: str) -> Optional[dict]:
    return await users_col.find_one({"id": uid}, {"_id": 0})


SESSION_INVALIDATED_DETAIL = {
    "code": "session_invalidated",
    "message": "You've been signed out because this account was signed in on another device.",
}


async def get_current_user(
        token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") == "challenge":
            raise HTTPException(status_code=401,
                                detail="Challenge token not allowed here")
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await get_user_by_id(uid)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Single-device session enforcement.
    token_sid = payload.get("sid")
    active_sid = user.get("active_session_id")
    if not token_sid or not active_sid or token_sid != active_sid:
        raise HTTPException(status_code=401, detail=SESSION_INVALIDATED_DETAIL)
    return user


async def rotate_session(user_id: str) -> str:
    """Mint a new `active_session_id` for the user, invalidating other devices."""
    sid = str(uuid.uuid4())
    await users_col.update_one(
        {"id": user_id},
        {"$set": {"active_session_id": sid, "updated_at": now_iso()}},
    )
    return sid


async def require_approved_student(
        u: dict = Depends(get_current_user)) -> dict:
    if u["role"] != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    if u["approval_status"] == "blocked":
        raise HTTPException(status_code=403, detail="Your access has been blocked by the hostel administrator.")
    if u["approval_status"] != "approved":
        raise HTTPException(status_code=403, detail="Student is not approved")

    # Always resolve the subscription through the Admin's record, not the student's
    # institution string (which may have been typed differently at registration).
    check_name = u.get("institution_or_hostel_name", "")
    admin_id = u.get("admin_id")
    if admin_id:
        admin = await users_col.find_one({"id": admin_id}, {"_id": 0, "institution_or_hostel_name": 1})
        if admin:
            check_name = admin.get("institution_or_hostel_name", check_name)
    else:
        # Fallback: try to resolve admin by matching institution name
        admin = await users_col.find_one(
            {"role": "admin", "institution_or_hostel_name": check_name},
            {"_id": 0, "institution_or_hostel_name": 1, "id": 1}
        )
        if admin:
            check_name = admin.get("institution_or_hostel_name", check_name)
            u["admin_id"] = admin["id"]

    sub = await get_subscription_status(check_name)
    if sub["status"] in ["TRIAL_EXPIRED", "SUBSCRIPTION_EXPIRED", "SUSPENDED"]:
        raise HTTPException(
            status_code=403,
            detail="Your hostel administration does not currently have an active subscription. Please contact your hostel administrator."
        )

    return u

@api.post("/auth/change-password")
async def change_password(payload: ChangePasswordRequest, u: dict = Depends(get_current_user)):
    user = await users_col.find_one({"id": u["id"]}, {"password_hash": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect current password.")
        
    new_hash = hash_password(payload.new_password)
    now = datetime.now(IST).isoformat()
    await users_col.update_one(
        {"id": u["id"]},
        {"$set": {"password_hash": new_hash, "updated_at": now}}
    )
    return {"ok": True}

async def log_activity(
        request: Optional[Request],
        user_id: str,
        role: str,
        institution: str,
        action: str,
        details: str = ""):
    await activity_logs_col.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "role": role,
        "institution": institution,
        "action": action,
        "details": details,
        "ip_address": (request.client.host if request and request.client else "unknown"),
        "timestamp": now_iso()
    })


def require_permission(permission: str):
    async def permission_checker(u: dict = Depends(get_current_user)) -> dict:
        from security import has_permission, Role
        if not has_permission(u.get("role", ""), permission):
            # Special case for global admins who bypass institution checks
            if u.get(
                    "role",
                    "").upper() in [
                    Role.SUPER_ADMIN.value,
                    Role.FINANCE_ADMIN.value]:
                pass
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Permission denied: Requires {permission}")
        return u
    return permission_checker


async def require_tenant_access(
        institution_name: str,
        u: dict = Depends(get_current_user)):
    from security import Role
    user_role = u.get("role", "").upper()
    if user_role in [
            Role.SUPER_ADMIN.value,
            Role.FINANCE_ADMIN.value,
            Role.SUPPORT_ADMIN.value]:
        return True  # Global roles can access any tenant

    if u.get("institution_or_hostel_name") != institution_name:
        raise HTTPException(
            status_code=403,
            detail="Tenant isolation violation")
    return True

# Legacy admin requirement


async def require_admin(u: dict = Depends(
        require_permission("MANAGE_STUDENTS"))) -> dict:
    return u


async def get_subscription_status(institution_name: str) -> dict:
    from datetime import datetime, timedelta
    import math
    sub = await subscriptions_col.find_one({"institution_or_hostel_name": institution_name}, {"_id": 0})
    student_count = await users_col.count_documents({"institution_or_hostel_name": institution_name, "role": "student", "approval_status": "approved"})

    if not sub:
        return {
            "institution_or_hostel_name": institution_name,
            "status": "SUBSCRIPTION_EXPIRED",
            "is_trial": False,
            "days_remaining": 0,
            "student_limit": 0,
            "registered_students": student_count,
            "expiry_date": None,
            "billing_contact": None,
            "plan_type": None,
            "auto_renew": False
        }

    now_dt = datetime.now(IST)
    current_status = sub.get("status", "SUBSCRIPTION_EXPIRED")
    is_trial = sub.get("is_trial", False) or current_status in ["TRIAL_ACTIVE", "TRIAL_EXPIRED", "FREE_TRIAL"] or sub.get("plan_type") == "trial"
    days_remaining = 0
    expiry_date_str = None
    
    if current_status == "ACTIVE" and not sub.get("is_trial", False):
        sub_end_str = sub.get("subscription_end_date")
        if sub_end_str:
            sub_end_dt = datetime.fromisoformat(sub_end_str)
            if sub_end_dt.tzinfo is None:
                sub_end_dt = sub_end_dt.replace(tzinfo=IST)
            if now_dt >= sub_end_dt:
                current_status = "SUBSCRIPTION_EXPIRED"
                await subscriptions_col.update_one({"institution_or_hostel_name": institution_name}, {"$set": {"status": current_status}})
            else:
                days_remaining = max(1, int(math.ceil((sub_end_dt - now_dt).total_seconds() / 86400.0)))
                expiry_date_str = sub_end_str
    elif is_trial:
        trial_start_str = sub.get("trial_start_date")
        trial_end_str = sub.get("trial_end_date")
        
        trial_start_dt = None
        trial_end_dt = None
        
        if trial_start_str:
            try:
                trial_start_dt = datetime.fromisoformat(trial_start_str)
            except (ValueError, TypeError):
                trial_start_dt = None
        if trial_end_str:
            try:
                trial_end_dt = datetime.fromisoformat(trial_end_str)
            except (ValueError, TypeError):
                trial_end_dt = None
                
        needs_healing = False
        if not trial_start_dt or not trial_end_dt or (trial_end_dt - trial_start_dt).days != 10 or (trial_end_dt - now_dt).days > 10 or sub.get("days_remaining") == 9999:
            needs_healing = True
            
        if needs_healing:
            admin_user = await users_col.find_one({"institution_or_hostel_name": institution_name, "role": "admin"}, {"created_at": 1, "_id": 0})
            if admin_user and admin_user.get("created_at"):
                try:
                    trial_start_dt = datetime.fromisoformat(admin_user["created_at"])
                except (ValueError, TypeError):
                    trial_start_dt = now_dt
            elif not trial_start_dt:
                trial_start_dt = now_dt
                
            if trial_start_dt.tzinfo is None:
                trial_start_dt = trial_start_dt.replace(tzinfo=IST)
                
            trial_end_dt = trial_start_dt + timedelta(days=10)
            trial_start_str = trial_start_dt.isoformat()
            trial_end_str = trial_end_dt.isoformat()
            
            update_fields = {
                "trial_start_date": trial_start_str,
                "trial_end_date": trial_end_str,
                "is_trial": True,
                "student_limit": 999999,
                "plan_type": "trial"
            }
            if now_dt >= trial_end_dt:
                current_status = "TRIAL_EXPIRED"
                update_fields["status"] = "TRIAL_EXPIRED"
            else:
                current_status = "TRIAL_ACTIVE"
                update_fields["status"] = "TRIAL_ACTIVE"
                
            await subscriptions_col.update_one(
                {"institution_or_hostel_name": institution_name},
                {"$set": update_fields, "$unset": {"days_remaining": ""}}
            )
            sub.update(update_fields)
        
        if trial_end_dt.tzinfo is None:
            trial_end_dt = trial_end_dt.replace(tzinfo=IST)
            
        diff_sec = (trial_end_dt - now_dt).total_seconds()
        if diff_sec <= 0:
            current_status = "TRIAL_EXPIRED"
            days_remaining = 0
            if sub.get("status") != "TRIAL_EXPIRED":
                await subscriptions_col.update_one({"institution_or_hostel_name": institution_name}, {"$set": {"status": current_status}})
        else:
            current_status = "TRIAL_ACTIVE"
            days_remaining = int(math.ceil(diff_sec / 86400.0))
            days_remaining = max(1, min(10, days_remaining))
            if sub.get("status") != "TRIAL_ACTIVE":
                await subscriptions_col.update_one({"institution_or_hostel_name": institution_name}, {"$set": {"status": current_status}})
        expiry_date_str = trial_end_str
    else:
        days_remaining = 0

    return {
        "institution_or_hostel_name": institution_name,
        "status": current_status,
        "is_trial": is_trial,
        "days_remaining": days_remaining,
        "student_limit": sub.get("student_limit", 250),
        "registered_students": student_count,
        "expiry_date": expiry_date_str,
        "billing_contact": sub.get("billing_contact"),
        "plan_type": sub.get("plan_type"),
        "auto_renew": sub.get("auto_renew", False)
    }


async def require_active_subscription_admin(
        u: dict = Depends(require_admin)) -> dict:
    sub = await get_subscription_status(u["institution_or_hostel_name"])
    if sub["status"] in ["TRIAL_EXPIRED", "SUBSCRIPTION_EXPIRED", "SUSPENDED"]:
        raise HTTPException(status_code=403, detail="SUBSCRIPTION_EXPIRED")
    return u


def project_menu(d: dict) -> dict:
    return {
        "day": d["day"],
        "breakfast_items": d.get("breakfast_items", []),
        "lunch_items": d.get("lunch_items", []),
        "dinner_items": d.get("dinner_items", []),
        "breakfast_custom_question": d.get("breakfast_custom_question"),
        "lunch_custom_question": d.get("lunch_custom_question"),
        "dinner_custom_question": d.get("dinner_custom_question"),
    }


def project_plan(d: Optional[dict]) -> Optional[dict]:
    if not d:
        return None
    return {
        "date": d["date"],
        "breakfast": d.get("breakfast", {}),
        "lunch": d.get("lunch", {}),
        "dinner": d.get("dinner", {}),
        "updated_at": d.get("updated_at"),
    }


# ---------------------------------------------------------------------------
# SMTP — Email OTP delivery
# ---------------------------------------------------------------------------

EMAIL_RE = _re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def is_valid_email(s: str) -> bool:
    return bool(s) and bool(EMAIL_RE.match(s.strip()))


def normalize_email(s: str) -> str:
    return (s or "").strip().lower()


def gen_otp() -> str:
    """Cryptographically secure N-digit OTP."""
    n = max(4, OTP_LENGTH)
    upper = 10 ** n
    return f"{secrets.randbelow(upper):0{n}d}"


def _build_registration_email(user_name: str, otp: str) -> _EmailMessage:
    msg = _EmailMessage()
    msg["Subject"] = "Verify Your Email Address"
    msg["From"] = _formataddr((FROM_NAME, FROM_EMAIL))
    # `To` is set by send_email_otp
    text = (
        f"Hello {user_name},\n\n"
        f"Welcome to MessMate.\n\n"
        f"Your verification code is:\n\n"
        f"{otp}\n\n"
        f"This code is valid for {OTP_EXPIRY_MIN} minutes.\n\n"
        f"If you did not request this account, please ignore this email.\n\n"
        f"Thank you."
    )
    html = (
        f"<div style=\"font-family:-apple-system,Segoe UI,Roboto,sans-serif;"
        f"max-width:520px;margin:auto;padding:32px;color:#0B1220\">"
        f"<h2 style=\"margin:0 0 16px\">Verify your email</h2>"
        f"<p>Hello <strong>{user_name}</strong>,</p>"
        f"<p>Welcome to <strong>MessMate</strong>. Your verification code is:</p>"
        f"<div style=\"font-size:32px;font-weight:700;letter-spacing:8px;"
        f"background:#EAFBF0;color:#15803D;padding:16px 24px;border-radius:12px;"
        f"text-align:center;margin:24px 0\">{otp}</div>"
        f"<p style=\"color:#5B6675\">This code is valid for {OTP_EXPIRY_MIN} minutes.</p>"
        f"<p style=\"color:#5B6675;font-size:13px\">If you did not request this account, "
        f"please ignore this email.</p>"
        f"<hr style=\"border:none;border-top:1px solid #E5E7EB;margin:24px 0\" />"
        f"<p style=\"color:#9CA3AF;font-size:12px\">— MessMate</p>"
        f"</div>"
    )
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


def _build_forgot_email(user_name: str, otp: str) -> _EmailMessage:
    msg = _EmailMessage()
    msg["Subject"] = "Password Reset Verification Code"
    msg["From"] = _formataddr((FROM_NAME, FROM_EMAIL))
    text = (
        f"Hello {user_name},\n\n"
        f"Your password reset code is:\n\n"
        f"{otp}\n\n"
        f"This code is valid for {OTP_EXPIRY_MIN} minutes.\n\n"
        f"If you did not request this password reset, please ignore this email.\n\n"
        f"Thank you."
    )
    html = (
        f"<div style=\"font-family:-apple-system,Segoe UI,Roboto,sans-serif;"
        f"max-width:520px;margin:auto;padding:32px;color:#0B1220\">"
        f"<h2 style=\"margin:0 0 16px\">Password reset</h2>"
        f"<p>Hello <strong>{user_name}</strong>,</p>"
        f"<p>Your password reset code is:</p>"
        f"<div style=\"font-size:32px;font-weight:700;letter-spacing:8px;"
        f"background:#FEF2F2;color:#B91C1C;padding:16px 24px;border-radius:12px;"
        f"text-align:center;margin:24px 0\">{otp}</div>"
        f"<p style=\"color:#5B6675\">This code is valid for {OTP_EXPIRY_MIN} minutes.</p>"
        f"<p style=\"color:#5B6675;font-size:13px\">If you did not request a password reset, "
        f"please ignore this email.</p>"
        f"<hr style=\"border:none;border-top:1px solid #E5E7EB;margin:24px 0\" />"
        f"<p style=\"color:#9CA3AF;font-size:12px\">— MessMate</p>"
        f"</div>"
    )
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


async def _get_gmail_access_token() -> str:
    """Exchange refresh token for an access token."""
    url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": GMAIL_CLIENT_ID,
        "client_secret": GMAIL_CLIENT_SECRET,
        "refresh_token": GMAIL_REFRESH_TOKEN,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, data=payload)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to refresh Gmail token: {resp.status_code} {resp.text}")
    return resp.json()["access_token"]


async def _gmail_send_async(
    *, to: str, subject: str, html: str, text: str
) -> None:
    """Send email via Gmail HTTP API (port 443 — bypasses SMTP port blocks)."""
    _TIMEOUT = 15.0
    _MAX_RETRIES = 3
    last_exc: Exception = RuntimeError("Unknown error")

    # Construct the raw email message
    msg = _EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    # Gmail API requires URL-safe base64 encoding
    raw_msg = _base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            # Refresh token on every attempt to ensure it's valid
            access_token = await _get_gmail_access_token()
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
            url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
            
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    url, 
                    json={"raw": raw_msg}, 
                    headers=headers
                )
            
            if resp.status_code in (200, 201):
                logger.info("Gmail: email sent to=%s attempt=%d id=%s", to, attempt, resp.json().get("id"))
                return  # success
            
            err_body = resp.text
            raise RuntimeError(f"Gmail API error {resp.status_code}: {err_body}")
        except Exception as e:
            last_exc = e
            logger.warning(
                "Gmail API attempt %d/%d failed to=%s err=%s",
                attempt, _MAX_RETRIES, to, e
            )
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(2 ** (attempt - 1))  # 1s then 2s backoff

    raise last_exc


async def send_email_otp(
    *, to: str, user_name: str, otp: str, purpose: str
) -> Optional[str]:
    """Send an OTP email via Gmail API. Returns None on success, error string on failure."""
    if not GMAIL_CONFIGURED:
        logger.warning(
            "[DEV-OTP] purpose=%s to=%s otp=%s (Gmail not configured — missing env vars)",
            purpose, to, otp,
        )
        return None

    if purpose == "forgot_password":
        subject = "Your MessMate Verification Code"
        text = (
            f"Hello {user_name},\n\n"
            f"Your password reset code is:\n\n"
            f"{otp}\n\n"
            f"This OTP is valid for {OTP_EXPIRY_MIN} minutes.\n\n"
            f"If you did not request this code, please ignore this email.\n\n"
            f"Regards,\nMessMate Team"
        )
        html = (
            f'<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;'
            f'max-width:520px;margin:auto;padding:32px;color:#0B1220">'
            f'<h2 style="margin:0 0 16px">Password Reset</h2>'
            f'<p>Hello <strong>{user_name}</strong>,</p>'
            f'<p>Your password reset code is:</p>'
            f'<div style="font-size:36px;font-weight:700;letter-spacing:10px;'
            f'background:#FEF2F2;color:#B91C1C;padding:20px 24px;border-radius:12px;'
            f'text-align:center;margin:24px 0">{otp}</div>'
            f'<p style="color:#5B6675">This OTP is valid for <strong>{OTP_EXPIRY_MIN} minutes</strong>.</p>'
            f'<p style="color:#5B6675;font-size:13px">If you did not request this code, please ignore this email.</p>'
            f'<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0" />'
            f'<p style="color:#9CA3AF;font-size:12px">Regards,<br/><strong>MessMate Team</strong></p>'
            f'</div>'
        )
    else:
        subject = "Your MessMate Verification Code"
        text = (
            f"Hello {user_name},\n\n"
            f"Your verification code is:\n\n"
            f"{otp}\n\n"
            f"This OTP is valid for {OTP_EXPIRY_MIN} minutes.\n\n"
            f"If you did not request this code, please ignore this email.\n\n"
            f"Regards,\nMessMate Team"
        )
        html = (
            f'<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;'
            f'max-width:520px;margin:auto;padding:32px;color:#0B1220">'
            f'<h2 style="margin:0 0 16px">Verify your email</h2>'
            f'<p>Hello <strong>{user_name}</strong>,</p>'
            f'<p>Welcome to <strong>MessMate</strong>. Your verification code is:</p>'
            f'<div style="font-size:36px;font-weight:700;letter-spacing:10px;'
            f'background:#EAFBF0;color:#15803D;padding:20px 24px;border-radius:12px;'
            f'text-align:center;margin:24px 0">{otp}</div>'
            f'<p style="color:#5B6675">This OTP is valid for <strong>{OTP_EXPIRY_MIN} minutes</strong>.</p>'
            f'<p style="color:#5B6675;font-size:13px">If you did not request this code, please ignore this email.</p>'
            f'<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0" />'
            f'<p style="color:#9CA3AF;font-size:12px">Regards,<br/><strong>MessMate Team</strong></p>'
            f'</div>'
        )

    try:
        await _gmail_send_async(to=to, subject=subject, html=html, text=text)
        return None
    except Exception as e:
        logger.error(
            "Gmail send failed to=%s purpose=%s err=%s",
            to, purpose, e, exc_info=True
        )
        return str(e)


# ---------------------------------------------------------------------------
# Email OTP store
# ---------------------------------------------------------------------------
async def store_email_otp(*, email: str, purpose: str, otp: str) -> None:
    """Hash + upsert. ALWAYS replaces any existing OTP for this (email, purpose)."""
    now_dt = datetime.now(IST)
    await email_otps_col.update_one(
        {"email": email, "purpose": purpose},
        {"$set": {
            "email": email,
            "purpose": purpose,
            "otp_hash": pwd_context.hash(otp),
            "created_at": now_dt.isoformat(),
            "expires_at": (now_dt + timedelta(minutes=OTP_EXPIRY_MIN)).isoformat(),
            "verified": False,
            "attempts": 0,
        }},
        upsert=True,
    )


async def consume_email_otp(
        *, email: str, purpose: str, submitted: str) -> Dict[str, Any]:
    """Returns {ok, error?, doc?}.

    - ok=True only on exact match + not expired + not over-attempted.
    - Side effects: increments attempts on miss; deletes on success.
    """
    doc = await email_otps_col.find_one({"email": email, "purpose": purpose})
    if not doc:
        return {"ok": False, "error": "Invalid OTP"}
    # Expiry
    try:
        exp = datetime.fromisoformat(doc["expires_at"])
    except Exception:
        exp = datetime.now(IST) - timedelta(seconds=1)
    if exp <= datetime.now(IST):
        await email_otps_col.delete_one({"_id": doc["_id"]})
        return {"ok": False, "error": "OTP expired"}
    # Attempts
    if doc.get("attempts", 0) >= OTP_MAX_VERIFY_ATTEMPTS:
        await email_otps_col.delete_one({"_id": doc["_id"]})
        return {
            "ok": False,
            "error": "Too many attempts. Please request a new OTP."}
    # Match
    try:
        match = pwd_context.verify(submitted.strip(), doc["otp_hash"])
    except Exception:
        match = False
    if not match:
        await email_otps_col.update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        return {"ok": False, "error": "Invalid OTP"}
    # Success — delete it immediately
    await email_otps_col.delete_one({"_id": doc["_id"]})
    return {"ok": True, "doc": doc}


async def can_resend_otp(*, email: str, purpose: str) -> Optional[int]:
    """If still within cooldown, returns seconds remaining; else None."""
    doc = await email_otps_col.find_one({"email": email, "purpose": purpose})
    if not doc:
        return None
    try:
        created = datetime.fromisoformat(doc["created_at"])
    except Exception:
        return None
    elapsed = (datetime.now(IST) - created).total_seconds()
    if elapsed < OTP_RESEND_INTERVAL_SEC:
        return int(OTP_RESEND_INTERVAL_SEC - elapsed)
    return None


async def purge_expired_otps() -> int:
    cutoff = datetime.now(IST).isoformat()
    res = await email_otps_col.delete_many({"expires_at": {"$lt": cutoff}})
    return getattr(res, "deleted_count", 0)


# ---------------------------------------------------------------------------
# Emergent Push helper
# ---------------------------------------------------------------------------
async def send_push(
    recipients: List[str],
    data: Dict[str, Any],
    idempotency_key: Optional[str] = None,
) -> None:
    """Fire a push notification via the Emergent relay. Safe to call w/ empty list."""
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        raise ValueError("push data must include title and message")
    cli = get_push_client()
    for i in range(0, len(recipients), 100):
        chunk = recipients[i:i + 100]
        payload: Dict[str, Any] = {"recipients": chunk, "data": data}
        if idempotency_key:
            payload["$idempotency_key"] = f"{idempotency_key}-{i // 100}"
        try:
            resp = await cli.post("/api/v1/push/trigger", json=payload)
            if resp.status_code == 401:
                logger.warning(
                    "EMERGENT_PUSH_KEY missing or invalid (push skipped)")
                return
            if resp.status_code >= 400:
                logger.warning("push trigger %s: %s",
                               resp.status_code, resp.text[:200])
        except Exception as e:
            logger.warning("push trigger failed (non-blocking): %s", e, exc_info=True)


# ---------------------------------------------------------------------------
# Auth — Email OTP
# ---------------------------------------------------------------------------


@api.get("/")
async def root():
    return {"app": "MessMate", "status": "ok"}


@api.post("/auth/register", response_model=Dict[str, Any], status_code=201)
async def register(payload: RegisterRequest, _=Depends(rate_limit)):
    """Create unverified account + send email OTP."""
    email = normalize_email(payload.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=400,
                            detail="Please enter a valid email address")
    if payload.confirm_password is not None and payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    await purge_expired_otps()

    existing = await users_col.find_one({"email": email}, {"_id": 0})
    if existing:
        if existing.get("email_verified"):
            raise HTTPException(
                status_code=400,
                detail="Email already registered")
        # Legacy unverified users in users_col: refresh details
        now = now_iso()
        await users_col.update_one(
            {"id": existing["id"]},
            {"$set": {
                "full_name": payload.full_name.strip(),
                "institution_or_hostel_name": payload.institution_or_hostel_name.strip(),
                "password_hash": hash_password(payload.password),
                "updated_at": now,
            }},
        )
        user_doc = await users_col.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        now = now_iso()
        role = payload.role or "student"

        # First admin to register for a brand-new institution auto-approves.
        is_first_admin = False
        if role == "admin":
            count = await users_col.count_documents({
                "role": "admin",
                "institution_or_hostel_name": payload.institution_or_hostel_name.strip(),
            })
            is_first_admin = count == 0

        user_doc = {
            "id": str(
                uuid.uuid4()),
            "full_name": payload.full_name.strip(),
            "email": email,
            "mobile_or_user_id": email,
            "institution_or_hostel_name": payload.institution_or_hostel_name.strip(),
            "password_hash": hash_password(
                payload.password),
            "role": role,
            "approval_status": "approved" if (
                role == "admin" and is_first_admin) else "pending",
            "email_verified": False,
            "created_at": now,
            "updated_at": now,
        }

        if role == "student":
            user_doc["department"] = payload.department.strip() if payload.department else None
            user_doc["academic_year"] = payload.academic_year.strip() if payload.academic_year else None
            user_doc["roll_number"] = payload.roll_number.strip() if payload.roll_number else None
            user_doc["room_number"] = payload.room_number.strip() if payload.room_number else None

        if role == "student":
            pending_existing = await pending_requests_col.find_one({"email": email})
            if pending_existing:
                user_doc["id"] = pending_existing["id"]
                user_doc["created_at"] = pending_existing["created_at"]
                await pending_requests_col.update_one({"email": email}, {"$set": user_doc})
            else:
                await pending_requests_col.insert_one(user_doc)
        else:
            await users_col.insert_one(user_doc)

    # Throttle: only mint a new OTP if cooldown elapsed
    wait_s = await can_resend_otp(email=email, purpose="registration")
    if wait_s is not None:
        # Don't reveal the OTP; ask user to wait
        return {
            "status": "verification_required",
            "email": email,
            "resend_available_in": wait_s,
            "message": "Verification code already sent. Check your inbox.",
        }

    otp = gen_otp()
    await store_email_otp(email=email, purpose="registration", otp=otp)
    err = await send_email_otp(
        to=email, user_name=user_doc["full_name"] if user_doc else payload.full_name, otp=otp, purpose="registration",
    )
    if err and GMAIL_CONFIGURED:
        logger.error(
            "Gmail API failed to send registration email to %s. Error: %s",
            email, err)
        raise HTTPException(
            status_code=424,
            detail=f"Failed to send email: {err}"
        )

    resp = {
        "status": "verification_required",
        "email": email,
        "resend_available_in": OTP_RESEND_INTERVAL_SEC,
        "expires_in": OTP_EXPIRY_MIN * 60,
    }
    if not GMAIL_CONFIGURED:
        resp["dev_otp"] = otp
    return resp


@api.post("/auth/verify-email", response_model=Dict[str, Any])
async def verify_email(payload: VerifyEmailRequest):
    """Verify the registration OTP → mark verified → auto-login or wait for approval."""
    email = normalize_email(payload.email)

    # Check users_col first (admins or previously approved users)
    user = await users_col.find_one({"email": email}, {"_id": 0})
    is_pending = False

    if not user:
        # Check pending_requests_col for students
        user = await pending_requests_col.find_one({"email": email}, {"_id": 0})
        is_pending = True

    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    if user.get("email_verified"):
        if is_pending:
            return {"status": "pending_approval", "email": email}
        # Re-issue access token rather than failing.
        sid = await rotate_session(user["id"])
        token = create_token({"sub": user["id"],
                              "sid": sid,
                              "role": user["role"],
                              "status": user["approval_status"]})
        return {"access_token": token, "user": to_public(user)}

    result = await consume_email_otp(email=email, purpose="registration", submitted=payload.otp)
    if not result["ok"]:
        err = result.get("error") or "Invalid OTP"
        code = 410 if err == "OTP expired" else 400
        raise HTTPException(status_code=code, detail=err)

    now = now_iso()
    user["email_verified"] = True
    user["updated_at"] = now

    if is_pending:
        await pending_requests_col.update_one(
            {"id": user["id"]},
            {"$set": {"email_verified": True, "updated_at": now}},
        )
        return {"status": "pending_approval", "email": email}
    else:
        await users_col.update_one(
            {"id": user["id"]},
            {"$set": {"email_verified": True, "updated_at": now}},
        )
        
        # Free Trial Creation Logic (Ensure ONLY ONE trial per Admin lifetime)
        if user["role"] == "admin":
            inst_name = user.get("institution_or_hostel_name")
            admin_id = user.get("id")
            admin_email = user.get("email")
            sub_count = await subscriptions_col.count_documents({
                "$or": [
                    {"institution_or_hostel_name": inst_name},
                    {"admin_email": admin_email},
                    {"admin_id": admin_id}
                ]
            })
            if sub_count == 0:
                from datetime import datetime, timedelta
                now_dt = datetime.now(IST)
                trial_end = now_dt + timedelta(days=10)
                sub_doc = {
                    "institution_or_hostel_name": inst_name,
                    "admin_id": admin_id,
                    "admin_email": admin_email,
                    "status": "TRIAL_ACTIVE",
                    "is_trial": True,
                    "trial_start_date": now_dt.isoformat(),
                    "trial_end_date": trial_end.isoformat(),
                    "subscription_start_date": None,
                    "subscription_end_date": None,
                    "grace_period_end_date": None,
                    "plan_type": "trial",
                    "student_limit": 999999, # Unlimited approvals during trial
                    "auto_renew": False,
                    "payment_status": "NONE",
                    "created_at": now,
                    "updated_at": now,
                }
                await subscriptions_col.insert_one(sub_doc)

        sid = await rotate_session(user["id"])
        token = create_token({"sub": user["id"],
                              "sid": sid,
                              "role": user["role"],
                              "status": user["approval_status"]})
        return {"access_token": token, "user": to_public(user)}


@api.post("/auth/login", response_model=TokenResponse)
async def login_email(payload: LoginRequest, _=Depends(rate_limit)):
    """Single-step email + password login. Verified accounts get a token."""
    email = normalize_email(payload.email)
    user = await users_col.find_one({"email": email}, {"_id": 0})

    if not user:
        # Check if they are pending
        pending = await pending_requests_col.find_one({"email": email}, {"_id": 0})
        if pending and verify_password(
                payload.password,
                pending["password_hash"]):
            if not pending.get("email_verified"):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "email_not_verified",
                        "message": "Please verify your email to continue.",
                        "email": email,
                    },
                )
            raise HTTPException(
                status_code=403,
                detail="Your account is pending admin approval. Please wait.",
            )
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password")

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password")

    if not user.get("email_verified"):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "email_not_verified",
                "message": "Please verify your email to continue.",
                "email": email,
            },
        )
    
    if user.get("approval_status") == "blocked":
        raise HTTPException(
            status_code=403,
            detail="Your access has been blocked by the hostel administrator.",
        )

    if user.get("role") == "student" and user.get("approval_status") == "approved":
        # Resolve subscription through Admin's account, not student's institution string.
        # This prevents mismatches when the student typed the institution name differently.
        check_name = user.get("institution_or_hostel_name", "")
        admin_id = user.get("admin_id")
        if admin_id:
            admin = await users_col.find_one({"id": admin_id}, {"_id": 0, "institution_or_hostel_name": 1})
            if admin:
                check_name = admin.get("institution_or_hostel_name", check_name)
        else:
            # Fallback: resolve admin by institution name match (handles legacy records)
            admin = await users_col.find_one(
                {"role": "admin", "institution_or_hostel_name": check_name},
                {"_id": 0, "institution_or_hostel_name": 1}
            )
            if admin:
                check_name = admin.get("institution_or_hostel_name", check_name)

        sub = await get_subscription_status(check_name)
        if sub["status"] in ["TRIAL_EXPIRED", "SUBSCRIPTION_EXPIRED", "SUSPENDED"]:
            raise HTTPException(
                status_code=403,
                detail="Your hostel administration does not currently have an active subscription. Please contact your hostel administrator."
            )

    sid = await rotate_session(user["id"])
    token = create_token({"sub": user["id"], "sid": sid, "role": user["role"],
                          "status": user["approval_status"]})

    import asyncio
    asyncio.create_task(
        log_activity(
            None,
            user["id"],
            user["role"],
            user.get(
                "institution_or_hostel_name",
                ""),
            "LOGIN_SUCCESS"))

    return {"access_token": token, "token_type": "bearer", "refresh_token": create_token(
        {"sub": str(user["id"]), "type": "refresh"}, minutes=7 * 24 * 60), "user": to_public(user)}


class RefreshRequest(BaseModel):
    refresh_token: str


@api.post("/auth/refresh")
async def refresh_token(payload: RefreshRequest, _=Depends(rate_limit)):
    try:
        token_payload = jwt.decode(
            payload.refresh_token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM])
        if token_payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")

        uid = token_payload.get("sub")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await get_user_by_id(uid)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        new_sid = await rotate_session(uid)
        new_token = create_token({
            "sub": str(user["id"]),
            "role": user["role"],
            "sid": new_sid
        })

        return {"access_token": new_token, "token_type": "bearer", "refresh_token": create_token(
            {"sub": str(user["id"]), "type": "refresh"}, minutes=7 * 24 * 60), "user": to_public(user)}
    except JWTError:
        raise HTTPException(status_code=401,
                            detail="Invalid or expired refresh token")


@api.post("/auth/resend-otp")
async def resend_otp(payload: ResendOtpEmailRequest):
    """Resend OTP for registration or forgot_password. 60-second cooldown."""
    email = normalize_email(payload.email)
    purpose = payload.purpose
    user = await users_col.find_one({"email": email}, {"_id": 0})
    if not user:
        user = await pending_requests_col.find_one({"email": email}, {"_id": 0})

    if not user:
        # Don't leak existence for forgot password
        if purpose == "forgot_password":
            return {
                "status": "ok",
                "resend_available_in": OTP_RESEND_INTERVAL_SEC}
        raise HTTPException(status_code=404, detail="Account not found")

    if purpose == "registration" and user.get("email_verified"):
        raise HTTPException(status_code=400,
                            detail="Email already verified. Please log in.")

    wait_s = await can_resend_otp(email=email, purpose=purpose)
    if wait_s is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {wait_s}s before requesting another code.",
        )

    otp = gen_otp()
    await store_email_otp(email=email, purpose=purpose, otp=otp)
    err = await send_email_otp(
        to=email, user_name=user["full_name"], otp=otp, purpose=purpose,
    )
    if err and GMAIL_CONFIGURED:
        logger.error(
            "Gmail API failed to send email to %s. Error: %s",
            email, err)
        raise HTTPException(
            status_code=424,
            detail=f"Failed to send email: {err}"
        )
    return {"status": "ok", "resend_available_in": OTP_RESEND_INTERVAL_SEC,
            "expires_in": OTP_EXPIRY_MIN * 60}


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    """Start the password-reset flow. Always returns 200 — never leak existence."""
    email = normalize_email(payload.email)
    user = await users_col.find_one({"email": email}, {"_id": 0})
    if not user:
        # Silent OK (anti-enumeration)
        return {"status": "ok", "resend_available_in": OTP_RESEND_INTERVAL_SEC,
                "expires_in": OTP_EXPIRY_MIN * 60}

    wait_s = await can_resend_otp(email=email, purpose="forgot_password")
    if wait_s is not None:
        return {"status": "ok", "resend_available_in": wait_s,
                "expires_in": OTP_EXPIRY_MIN * 60}

    otp = gen_otp()
    await store_email_otp(email=email, purpose="forgot_password", otp=otp)
    err = await send_email_otp(
        to=email, user_name=user["full_name"], otp=otp, purpose="forgot_password",
    )
    if err and SMTP_CONFIGURED:
        logger.error(
            "SMTP failed to send forgot password email to %s. Error: %s",
            email, err)
        raise HTTPException(
            status_code=424,
            detail=f"Failed to send email: {err}"
        )
    return {"status": "ok", "resend_available_in": OTP_RESEND_INTERVAL_SEC,
            "expires_in": OTP_EXPIRY_MIN * 60}


@api.post("/auth/forgot-password/verify")
async def forgot_password_verify(payload: ForgotPasswordVerifyRequest):
    """Verify forgot-password OTP → mint a short-lived reset token (not deleted yet)."""
    email = normalize_email(payload.email)
    user = await users_col.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    result = await consume_email_otp(
        email=email, purpose="forgot_password", submitted=payload.otp,
    )
    if not result["ok"]:
        err = result.get("error") or "Invalid OTP"
        code = 410 if err == "OTP expired" else 400
        raise HTTPException(status_code=code, detail=err)

    reset_token = create_token(
        {"sub": user["id"], "email": email, "type": "reset"},
        minutes=RESET_TOKEN_EXPIRY_MIN,
    )
    return {"reset_token": reset_token,
            "expires_in": RESET_TOKEN_EXPIRY_MIN * 60}


@api.post("/auth/reset-password", response_model=TokenResponse)
async def reset_password(payload: ResetPasswordRequest):
    """Use the reset_token to set a new password + auto-login."""
    if payload.confirm_password is not None and payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    try:
        decoded = jwt.decode(
            payload.reset_token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400,
                            detail="Reset link expired. Please start over.")
    if decoded.get("type") != "reset":
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user = await users_col.find_one({"id": decoded.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    now = now_iso()
    new_hash = hash_password(payload.new_password)
    await users_col.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": new_hash, "updated_at": now}},
    )
    user["password_hash"] = new_hash
    user["updated_at"] = now
    sid = await rotate_session(user["id"])
    token = create_token({"sub": user["id"], "sid": sid, "role": user["role"],
                          "status": user["approval_status"]})
    return TokenResponse(access_token=token, user=to_public(user))


@api.get("/auth/me", response_model=UserPublic)
async def me(u: dict = Depends(get_current_user)):
    return u


@api.get("/subscription/status", response_model=SubscriptionPublic)
async def get_sub_status(u: dict = Depends(require_admin)):
    sub = await get_subscription_status(u["institution_or_hostel_name"])
    return sub

@api.get("/student/subscription/status", response_model=SubscriptionPublic)
async def get_student_sub_status(u: dict = Depends(get_current_user)):
    check_name = u.get("institution_or_hostel_name", "")
    admin_id = u.get("admin_id")
    if admin_id:
        admin = await users_col.find_one({"id": admin_id}, {"_id": 0, "institution_or_hostel_name": 1})
        if admin:
            check_name = admin.get("institution_or_hostel_name", check_name)
    sub = await get_subscription_status(check_name)
    return sub


@api.post("/subscription/renew")
async def renew_subscription(u: dict = Depends(require_admin)):
    # Mocking a payment success and renewing for 30 days
    from datetime import datetime, timedelta, timezone
    now_dt = datetime.now(IST)
    new_end = now_dt + timedelta(days=30)
    await subscriptions_col.update_one(
        {"institution_or_hostel_name": u["institution_or_hostel_name"]},
        {"$set": {
            "status": "ACTIVE",
            "is_trial": False,
            "subscription_start_date": now_dt.isoformat(),
            "subscription_end_date": new_end.isoformat(),
            "payment_status": "PAID"
        }}
    )
    return {"success": True, "message": "Subscription renewed successfully"}


@api.post("/subscription/order", response_model=OrderCreateResponse)
async def create_subscription_order(
        payload: OrderCreateRequest,
        u: dict = Depends(require_admin)):
    try:
        inst_name = u["institution_or_hostel_name"]
        
        # Determine actual approved students
        approved_count = await users_col.count_documents({
            "institution_or_hostel_name": inst_name,
            "role": "student",
            "approval_status": "approved"
        })
        
        sub_status = await get_subscription_status(inst_name)
        is_active = sub_status["status"] == "ACTIVE"
        
        if is_active:
            # Upgrade flow
            current_limit = sub_status["student_limit"]
            current_plan = sub_status["plan_type"]
            
            if payload.plan_type != current_plan:
                raise HTTPException(status_code=400, detail="Cannot change plan type during an upgrade.")
                
            min_students = current_limit + 250
            if payload.student_count < min_students:
                raise HTTPException(status_code=400, detail=f"Upgrade requires at least 250 additional students (Minimum: {min_students}).")
                
            additional_students = payload.student_count - current_limit
            amount_in_inr = additional_students * 3.0 if payload.plan_type == "monthly" else additional_students * 2.50 * 12
            action = "CAPACITY_UPGRADE"
            is_upgrade_flag = True
        else:
            # New or Renewal flow
            min_students = max(approved_count, 250)
            if payload.student_count < min_students:
                raise HTTPException(status_code=400, detail=f"Student count must be at least {min_students} based on approved students.")
                
            amount_in_inr = payload.student_count * 3.0 if payload.plan_type == "monthly" else payload.student_count * 2.50 * 12
            action = "SUBSCRIPTION_PURCHASE"
            is_upgrade_flag = False
            additional_students = 0

        amount_in_paise = int(amount_in_inr * 100)
        
        if razorpay_client:
            rp_order = razorpay_client.order.create({
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": f"receipt_{uuid.uuid4().hex[:8]}"
            })
            order_id = rp_order["id"]
        else:
            order_id = f"MM_ORDER_{uuid.uuid4().hex[:8].upper()}"

        doc = {
            "id": str(uuid.uuid4()),
            "institution_or_hostel_name": inst_name,
            "admin_id": u.get("id"),
            "order_id": order_id,
            "payment_id": None,
            "provider": "razorpay" if razorpay_client else "mock",
            "amount": amount_in_inr,
            "currency": "INR",
            "status": "PENDING",
            "transaction_date": None,
            "plan_type": payload.plan_type,
            "student_count": payload.student_count,
            "action": action,
            "is_upgrade": is_upgrade_flag,
            "additional_students": additional_students,
            "created_at": now_iso()
        }
        await transactions_col.insert_one(doc)
        return {"order_id": order_id, "amount": amount_in_inr, "currency": "INR"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_subscription_order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@api.post("/subscription/verify-payment")
async def verify_payment(
        payload: PaymentVerifyRequest,
        u: dict = Depends(require_admin)):
    try:
        from datetime import datetime, timedelta, timezone

        order = await transactions_col.find_one({"order_id": payload.order_id, "institution_or_hostel_name": u["institution_or_hostel_name"]})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order["status"] == "SUCCESS":
            return {"success": True, "message": "Already verified"}

        if razorpay_client and order["provider"] == "razorpay":
            try:
                razorpay_client.utility.verify_payment_signature({
                    'razorpay_order_id': payload.order_id,
                    'razorpay_payment_id': payload.payment_id,
                    'razorpay_signature': payload.signature
                })
            except Exception as e:
                await transactions_col.update_one({"id": order["id"]}, {"$set": {"status": "FAILED", "error_message": "Invalid signature"}})
                raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            if payload.signature != "mock_signature":
                await transactions_col.update_one({"id": order["id"]}, {"$set": {"status": "FAILED", "error_message": "Invalid signature"}})
                raise HTTPException(status_code=400, detail="Invalid signature")

        now_dt = datetime.now(IST)
        transaction_date = now_dt.isoformat()

        await transactions_col.update_one(
            {"id": order["id"]},
            {"$set": {
                "status": "SUCCESS",
                "payment_id": payload.payment_id,
                "transaction_date": transaction_date
            }}
        )

        # Enforce approved student minimum count
        approved_count = await users_col.count_documents({
            "institution_or_hostel_name": u["institution_or_hostel_name"],
            "role": "student",
            "approval_status": "approved"
        })
        min_required = max(approved_count, 250)
        if order.get("student_count", 0) < min_required and not order.get("is_upgrade", False):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot activate subscription: student count ({order['student_count']}) is below current approved student minimum ({min_required})."
            )

        # Get current sub to compute dates properly
        sub = await subscriptions_col.find_one({"institution_or_hostel_name": u["institution_or_hostel_name"]})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in verify_payment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error")

    is_upgrade = order.get("is_upgrade", False)

    if is_upgrade:
        # For upgrades, don't change the dates, only capacity
        event_type = "CAPACITY_UPGRADE"
        details = {
            "old_capacity": sub["student_limit"],
            "new_capacity": order["student_count"],
            "additional": order["additional_students"]}

        await subscriptions_col.update_one(
            {"institution_or_hostel_name": u["institution_or_hostel_name"]},
            {
                "$set": {
                    "student_limit": order["student_count"]
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "admin_id": u.get("id"),
                    "status": "ACTIVE",
                    "is_trial": False,
                    "subscription_start_date": now_dt.isoformat(),
                    "payment_status": "SUCCESS",
                    "payment_method": "Dummy/Test Payment",
                    "transaction_id": payload.payment_id or str(uuid.uuid4()),
                    "registered_students": 0,
                    "created_at": now_dt.isoformat(),
                    "plan_type": order.get("plan_type", "monthly")
                }
            },
            upsert=True
        )
        new_end = datetime.fromisoformat(sub["subscription_end_date"]) if sub and sub.get(
            "subscription_end_date") else (now_dt + timedelta(days=30))
    else:
        # Renewal or New Subscription
        event_type = "SUBSCRIPTION_PURCHASED"
        details = {
            "plan_type": order["plan_type"],
            "capacity": order["student_count"]}

        days_to_add = 30 if order["plan_type"] == "monthly" else 365

        # Start adding days from current expiry if it is in the future
        current_end_str = sub.get("subscription_end_date") if sub else None
        if current_end_str:
            current_end = datetime.fromisoformat(current_end_str)
            if current_end > now_dt:
                base_dt = current_end
            else:
                base_dt = now_dt
        else:
            base_dt = now_dt

        new_end = base_dt + timedelta(days=days_to_add)

        await subscriptions_col.update_one(
            {"institution_or_hostel_name": u["institution_or_hostel_name"]},
            {
                "$set": {
                    "status": "ACTIVE",
                    "is_trial": False,
                    "subscription_start_date": now_dt.isoformat(),
                    "subscription_end_date": new_end.isoformat(),
                    "payment_status": "SUCCESS",
                    "payment_method": "Dummy/Test Payment",
                    "transaction_id": payload.payment_id or str(uuid.uuid4()),
                    "student_limit": order["student_count"],
                    "plan_type": order["plan_type"]
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "admin_id": u.get("id"),
                    "registered_students": 0,
                    "created_at": now_dt.isoformat()
                }
            },
            upsert=True
        )

    # Log the event
    await subscription_events_col.insert_one({
        "id": str(uuid.uuid4()),
        "institution_or_hostel_name": u["institution_or_hostel_name"],
        "event_type": event_type,
        "event_date": transaction_date,
        "details": details
    })

    # Generate Invoice
    invoice_number = f"MM-INV-{uuid.uuid4().hex[:6].upper()}"
    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "institution_or_hostel_name": u["institution_or_hostel_name"],
        "amount": order["amount"],
        "tax": 0.0,
        "status": "Paid",
        "created_at": transaction_date,
        "plan_type": order["plan_type"],
        "student_count": order["student_count"],
        "subscription_period": f"{now_dt.strftime('%d %b %Y')} - {new_end.strftime('%d %b %Y')}",
        "payment_date": transaction_date
    }
    await invoices_col.insert_one(invoice)

    # Send Notification
    from services.notification_service import notify_institution

    if is_upgrade:
        title = "Capacity Upgraded Successfully"
        desc = f"Your capacity has been upgraded to {order['student_count']} students."
        template = "CapacityUpgrade"
    else:
        title = "Payment Successful"
        desc = f"Your subscription is now active until {new_end.strftime('%d %b %Y')}."
        template = "PaymentSuccess"

    context = {
        "institution": u["institution_or_hostel_name"],
        "plan": order["plan_type"],
        "students": order["student_count"],
        "amount": order["amount"],
        "valid_until": new_end.strftime('%d %b %Y'),
        "invoice_number": invoice_number
    }

    # Fire and forget (don't block the API response)
    import asyncio
    asyncio.create_task(
        notify_institution(
            db,
            u["institution_or_hostel_name"],
            "PAYMENT",
            title,
            desc,
            template,
            context))

    return {"success": True, "message": "Payment successful"}


@api.get("/subscription/transactions", response_model=List[TransactionPublic])
async def get_payment_history(
        skip: int = 0,
        limit: int = 50,
        u: dict = Depends(require_admin)):
    items = [r async for r in transactions_col.find(
        {"institution_or_hostel_name": u["institution_or_hostel_name"]}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit)]
    return items


@api.get("/subscription/invoices", response_model=List[InvoicePublic])
async def get_invoices(
        skip: int = 0,
        limit: int = 50,
        u: dict = Depends(require_admin)):
    items = [r async for r in invoices_col.find(
        {"institution_or_hostel_name": u["institution_or_hostel_name"]}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit)]
    return items


@api.get("/subscription/events", response_model=List[SubscriptionEventPublic])
async def get_subscription_events(
        skip: int = 0,
        limit: int = 50,
        u: dict = Depends(require_admin)):
    items = [r async for r in subscription_events_col.find(
        {"institution_or_hostel_name": u["institution_or_hostel_name"]}, {"_id": 0}
    ).sort("event_date", -1).skip(skip).limit(limit)]
    return items


class UpgradeOrderRequest(BaseModel):
    additional_students: int


@api.post("/subscription/upgrade-order", response_model=OrderCreateResponse)
async def create_upgrade_order(
        payload: UpgradeOrderRequest,
        u: dict = Depends(require_admin)):
    sub = await subscriptions_col.find_one({"institution_or_hostel_name": u["institution_or_hostel_name"]})
    if not sub:
        raise HTTPException(
            status_code=400,
            detail="No active subscription found")

    plan_type = sub.get("plan_type", "monthly")

    # Cost for additional students based on plan
    amount = payload.additional_students * \
        2.0 if plan_type == "monthly" else payload.additional_students * 1.5 * 12
    order_id = f"MM_UPGRADE_{uuid.uuid4().hex[:8].upper()}"

    doc = {
        "id": str(uuid.uuid4()),
        "institution_or_hostel_name": u["institution_or_hostel_name"],
        "admin_id": u.get("id"),
        "order_id": order_id,
        "payment_id": None,
        "provider": "mock",
        "amount": amount,
        "currency": "INR",
        "status": "PENDING",
        "transaction_date": None,
        "plan_type": plan_type,
        # The target total limit
        "student_count": sub["student_limit"] + payload.additional_students,
        "is_upgrade": True,
        "additional_students": payload.additional_students,
        "action": "CAPACITY_UPGRADE",
        "created_at": now_iso()
    }
    await transactions_col.insert_one(doc)
    return {"order_id": order_id, "amount": amount, "currency": "INR"}


class PaymentFailedRequest(BaseModel):
    order_id: str
    error_message: str
    payment_id: Optional[str] = None


@api.post("/subscription/payment-failed")
async def report_payment_failed(
        payload: PaymentFailedRequest,
        u: dict = Depends(require_admin)):
    order = await transactions_col.find_one({
        "order_id": payload.order_id,
        "institution_or_hostel_name": u["institution_or_hostel_name"]
    })

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await transactions_col.update_one(
        {"order_id": payload.order_id},
        {"$set": {
            "status": "FAILED",
            "payment_id": payload.payment_id,
            "error_message": payload.error_message,
            "transaction_date": now_iso()
        }}
    )

    # Log to subscription events
    event_id = str(uuid.uuid4())
    await subscription_events_col.insert_one({
        "id": event_id,
        "institution_or_hostel_name": u["institution_or_hostel_name"],
        "event_type": "PAYMENT_FAILED",
        "event_date": now_iso(),
        "details": {
            "order_id": payload.order_id,
            "error_message": payload.error_message,
            "amount": order["amount"]
        }
    })

    # Send Notification
    from services.notification_service import notify_institution
    import asyncio
    title = "Payment Failed"
    desc = f"Unfortunately your subscription payment was unsuccessful. Reason: {payload.error_message}"
    context = {
        "institution": u["institution_or_hostel_name"],
        "reason": payload.error_message,
        "order_id": payload.order_id
    }
    asyncio.create_task(
        notify_institution(
            db,
            u["institution_or_hostel_name"],
            "PAYMENT",
            title,
            desc,
            "PaymentFailed",
            context))

    return {"success": True}


class NotificationPreferencesRequest(BaseModel):
    email_notifications: bool
    push_notifications: bool
    capacity_alerts: bool
    renewal_reminders: bool
    payment_confirmations: bool
    invoice_emails: bool


@api.put("/subscription/preferences")
async def update_communication_preferences(
        payload: NotificationPreferencesRequest,
        u: dict = Depends(require_admin)):
    await subscriptions_col.update_one(
        {"institution_or_hostel_name": u["institution_or_hostel_name"]},
        {"$set": {"communication_preferences": payload.model_dump()}}
    )
    return {"success": True}


@api.put("/subscription/billing-contact")
async def update_billing_contact(
        payload: BillingContact,
        u: dict = Depends(require_admin)):
    await subscriptions_col.update_one(
        {"institution_or_hostel_name": u["institution_or_hostel_name"]},
        {"$set": {"billing_contact": payload.model_dump()}}
    )
    return {"success": True}


@api.get("/notifications", response_model=List[NotificationPublic])
async def get_notifications(u: dict = Depends(require_admin)):
    items = [r async for r in notifications_col.find(
        {"institution_or_hostel_name": u["institution_or_hostel_name"]}, {"_id": 0}
    ).sort("created_at", -1)]
    return items


@api.put("/notifications/{notification_id}/read")
async def mark_notification_read(
        notification_id: str,
        u: dict = Depends(require_admin)):
    await notifications_col.update_one(
        {"id": notification_id, "institution_or_hostel_name": u["institution_or_hostel_name"]},
        {"$set": {"read_status": True}}
    )
    return {"success": True}


@api.post("/cron/backup-db")
async def backup_database():
    """Mock endpoint for triggering database backup."""
    import asyncio
    await asyncio.sleep(1)  # simulate backup process
    return {
        "success": True,
        "message": "Database backup completed successfully."}


@api.post("/cron/subscription-reminders")
async def process_subscription_reminders():
    """
    Called by an external cron/scheduler daily.
    Evaluates trials and subscriptions for all institutions.
    """
    from services.notification_service import notify_institution
    from datetime import datetime, timezone

    now_dt = datetime.now(IST)

    async for sub in subscriptions_col.find({}):
        institution = sub["institution_or_hostel_name"]

        # Trial processing
        if sub.get("is_trial") and sub.get("trial_end_date"):
            end_dt = datetime.fromisoformat(sub["trial_end_date"])
            days_remaining = (end_dt - now_dt).days

            if days_remaining in [5, 3, 1, 0]:
                title = f"Your MessMate Trial Ends in {days_remaining} Days" if days_remaining > 0 else "Your free trial expires today"
                desc = "Purchase a subscription now to continue using MessMate without interruption."
                await notify_institution(db, institution, "TRIAL", title, desc, "TrialReminder", {"days": days_remaining, "institution": institution})

        # Expiry processing
        elif not sub.get("is_trial") and sub.get("subscription_end_date"):
            end_dt = datetime.fromisoformat(sub["subscription_end_date"])
            days_remaining = (end_dt - now_dt).days
            plan_type = sub.get("plan_type", "monthly")

            # Monthly vs Yearly schedule
            schedule = [
                7, 3, 1, 0] if plan_type == "monthly" else [
                30, 15, 7, 3, 1, 0]

            if days_remaining in schedule:
                title = "Your MessMate Subscription Expires Soon"
                desc = f"Your {plan_type.capitalize()} Subscription expires in {days_remaining} days. Renew now to avoid interruption."
                await notify_institution(db, institution, "SUBSCRIPTION", title, desc, "SubscriptionExpiring", {"days": days_remaining, "institution": institution, "plan": plan_type})

    return {"success": True, "message": "Cron job completed"}


class WebhookPayload(BaseModel):
    event: str
    payload: dict


@api.post("/subscription/webhook")
async def payment_webhook(payload: dict, request: Request):
    """
    Async payment gateway webhook. In production, verify signature via headers.
    """
    event = payload.get("event")
    data = payload.get("payload", {})

    if event == "payment.captured":
        order_id = data.get("order_id")
        payment_id = data.get("payment_id")

        if order_id:
            order = await transactions_col.find_one({"order_id": order_id})
            if order and order["status"] == "PENDING":
                # Mark as success (actual implementation would call
                # verify_payment logic internally)
                await transactions_col.update_one(
                    {"order_id": order_id},
                    {"$set": {"status": "SUCCESS", "payment_id": payment_id, "transaction_date": now_iso()}}
                )
    return {"status": "ok"}


class AutoRenewRequest(BaseModel):
    enabled: bool


@api.put("/subscription/auto-renew")
async def toggle_auto_renew(
        payload: AutoRenewRequest,
        u: dict = Depends(require_admin)):
    await subscriptions_col.update_one(
        {"institution_or_hostel_name": u["institution_or_hostel_name"]},
        {"$set": {"auto_renew": payload.enabled}}
    )
    return {"success": True, "auto_renew": payload.enabled}


@api.post("/auth/push-token")
async def save_push_token(
        payload: PushTokenInput,
        u: dict = Depends(get_current_user)):
    """Capture an Expo/FCM push token. Also registers with the Emergent relay."""
    await users_col.update_one(
        {"id": u["id"]},
        {"$set": {"push_token": payload.push_token.strip(),
                  "push_platform": payload.platform,
                  "updated_at": now_iso()}},
    )
    # Upsert into push_tokens collection (one doc per user/device combo)
    await push_tokens_col.update_one(
        {"user_id": u["id"], "device_token": payload.push_token.strip()},
        {"$set": {
            "user_id": u["id"], "device_token": payload.push_token.strip(),
            "platform": payload.platform or "android", "hostel": hostel_of(u),
            "role": u["role"], "updated_at": now_iso(),
        }, "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api.post("/register-push", status_code=201)
async def register_push(
        body: RegisterPushBody,
        u: dict = Depends(get_current_user)):
    """Relay device token registration to the Emergent push provider.

    The auth dep ensures we're tying it to the right user.
    """
    if body.user_id != u["id"]:
        raise HTTPException(status_code=403, detail="user_id mismatch")
    # Store locally too
    await push_tokens_col.update_one(
        {"user_id": u["id"], "device_token": body.device_token.strip()},
        {"$set": {
            "user_id": u["id"], "device_token": body.device_token.strip(),
            "platform": body.platform, "hostel": hostel_of(u),
            "role": u["role"], "updated_at": now_iso(),
        }, "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    # Relay
    cli = get_push_client()
    try:
        resp = await cli.post("/api/v1/push/users/register", json={
            "user_id": body.user_id,
            "platform": body.platform,
            "device_token": body.device_token,
        })
        if resp.status_code == 401:
            logger.warning("EMERGENT_PUSH_KEY missing or invalid")
        elif resp.status_code >= 500:
            logger.warning("Push provider 5xx: %s", resp.text[:200])
    except Exception as e:
        logger.warning("Push register relay failed (non-blocking): %s", e, exc_info=True)
    return {"status": "registered"}


# ---------------------------------------------------------------------------
# Student routes
# ---------------------------------------------------------------------------

@api.get("/student/subscription/status")
async def student_subscription_status(u: dict = Depends(get_current_user)):
    """
    Returns the subscription status for the institution/hostel the student belongs to.
    
    Access rules enforced here:
    - Student must be logged in (valid JWT).
    - Student must have approval_status == "approved".
    - Student must NOT be blocked.
    - The linked admin must have an active Free Trial or active Subscription.
    
    This endpoint is intentionally separate from /api/subscription/status which
    requires admin role. Students use this endpoint so the frontend SubscriptionGuard
    correctly inherits the admin's subscription status.
    """
    if u["role"] != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    
    approval = u.get("approval_status", "pending")
    
    if approval == "blocked":
        raise HTTPException(
            status_code=403,
            detail={
                "code": "student_blocked",
                "message": "Your access has been blocked by the hostel administrator."
            }
        )
    
    if approval != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "code": "student_pending",
                "message": "Your account is pending admin approval. Please wait."
            }
        )
    
    institution = u.get("institution_or_hostel_name", "")
    if not institution:
        raise HTTPException(status_code=400, detail="Institution not found on student account")
    
    # Look up the admin's subscription for this institution
    sub = await get_subscription_status(institution)
    
    # Do NOT block here — return the status so the frontend can decide.
    # The frontend SubscriptionGuard will show the appropriate lock screen
    # if the admin's subscription is expired.
    return sub


@api.get("/student/meta")
async def student_meta(_: dict = Depends(require_approved_student)):
    return {"reasons": REASONS, "days": DAYS}



@api.get("/student/today")
async def student_today(
    u: dict = Depends(require_approved_student),
    for_: Literal["today", "tomorrow"] = Query("today", alias="for"),
):
    base = date.fromisoformat(today_iso())
    target_date = (
        base +
        timedelta(
            days=1)).isoformat() if for_ == "tomorrow" else base.isoformat()
    day = day_of_week(date.fromisoformat(target_date))
    h = hostel_of(u)
    menu_doc = await menus_col.find_one({"hostel": h, "day": day}, {"_id": 0})
    plan_doc = await daily_plans_col.find_one(
        {"student_id": u["id"], "date": target_date}, {"_id": 0}
    )
    return {
        "date": target_date,
        "day": day,
        "for": for_,
        "menu": project_menu(menu_doc) if menu_doc else None,
        "plan": project_plan(plan_doc),
    }


@api.put("/student/today")
async def upsert_today_plan(
    payload: DailyPlanUpsert, u: dict = Depends(require_approved_student)
):
    target = payload.date or today_iso()
    try:
        date.fromisoformat(target)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date")

    now = now_iso()
    set_doc = {
        "student_id": u["id"], "date": target,
        "hostel": hostel_of(u),
        "breakfast": payload.breakfast.model_dump(),
        "lunch": payload.lunch.model_dump(),
        "dinner": payload.dinner.model_dump(),
        "updated_at": now,
    }
    await daily_plans_col.update_one(
        {"student_id": u["id"], "date": target},
        {"$set": set_doc, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now}},
        upsert=True,
    )
    saved = await daily_plans_col.find_one(
        {"student_id": u["id"], "date": target}, {"_id": 0}
    )
    return {"ok": True, "plan": project_plan(saved)}


@api.post("/student/feedback")
async def post_feedback(
    payload: FeedbackInput, u: dict = Depends(require_approved_student)
):
    now = now_iso()
    await feedback_col.insert_one({
        "id": str(uuid.uuid4()),
        "student_id": u["id"], "hostel": hostel_of(u),
        "date": today_iso(),
        "feedback_text": payload.feedback_text.strip(),
        "anonymous": True, "created_at": now,
    })
    return {"ok": True, "created_at": now}


@api.get("/student/menu/week")
async def student_menu_week(u: dict = Depends(require_approved_student)):
    h = hostel_of(u)
    docs = []
    for d in DAYS:
        m = await menus_col.find_one({"hostel": h, "day": d}, {"_id": 0})
        docs.append(
            project_menu(m) if m else {
                "day": d,
                "breakfast_items": [],
                "lunch_items": [],
                "dinner_items": [],
                "breakfast_custom_question": None,
                "lunch_custom_question": None,
                "dinner_custom_question": None,
            })
    reactions: Dict[str, str] = {}
    async for r in menu_reactions_col.find(
        {"student_id": u["id"]}, {"_id": 0, "day": 1, "meal_type": 1, "reaction": 1}
    ):
        reactions[f"{r['day']}:{r['meal_type']}"] = r["reaction"]
    for d_doc in docs:
        d_doc["reactions"] = {
            "breakfast": reactions.get(f"{d_doc['day']}:breakfast", "no_response"),
            "lunch": reactions.get(f"{d_doc['day']}:lunch", "no_response"),
            "dinner": reactions.get(f"{d_doc['day']}:dinner", "no_response"),
        }
    return {"days": docs}


@api.get("/student/menu/month")
async def student_menu_month(u: dict = Depends(require_approved_student)):
    week = await student_menu_week(u)  # type: ignore[arg-type]
    return {"weeks": [{"label": f"Week {i + 1}",
                       "days": week["days"]} for i in range(4)]}


@api.put("/student/menu/reaction")
async def upsert_reaction(
    payload: ReactionUpsert, u: dict = Depends(require_approved_student)
):
    if payload.day not in DAYS:
        raise HTTPException(status_code=400, detail="Invalid day")
    now = now_iso()
    await menu_reactions_col.update_one(
        {"student_id": u["id"], "day": payload.day, "meal_type": payload.meal_type},
        {
            "$set": {"reaction": payload.reaction, "hostel": hostel_of(u), "updated_at": now},
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "student_id": u["id"], "day": payload.day,
                "meal_type": payload.meal_type, "created_at": now,
            },
        },
        upsert=True,
    )
    return {"ok": True, "reaction": payload.reaction}


@api.get("/student/wastage")
async def student_wastage(
    u: dict = Depends(require_approved_student),
    range: int = Query(7, ge=1, le=365),
    meal: Literal["all", "breakfast", "lunch", "dinner"] = Query("all"),
):
    h = hostel_of(u)
    today = date.fromisoformat(today_iso())
    start = today - timedelta(days=range - 1)
    rows = [r async for r in wastage_col.find(
        {"hostel": h, "date": {"$gte": start.isoformat(), "$lte": today.isoformat()}},
        {"_id": 0},
    ).sort("date", 1)]
    series = []
    for r in rows:
        v = (
            r.get(
                "breakfast_wastage_kg",
                0) +
            r.get(
                "lunch_wastage_kg",
                0) +
            r.get(
                "dinner_wastage_kg",
                0)) if meal == "all" else r.get(
                    f"{meal}_wastage_kg",
            0)
        series.append({"date": r["date"], "value": round(v, 2)})

    def row(d: date) -> Optional[dict]:
        for r in rows:
            if r["date"] == d.isoformat():
                return r
        return None

    async def fallback(d: date) -> Optional[dict]:
        return row(d) or await wastage_col.find_one(
            {"hostel": h, "date": d.isoformat()}, {"_id": 0}
        )

    today_row = await fallback(today)
    yesterday_row = await fallback(today - timedelta(days=1))
    last_week_row = await fallback(today - timedelta(days=7))

    def total(r: Optional[dict]) -> Optional[float]:
        if not r:
            return None
        return round(
            r.get(
                "breakfast_wastage_kg",
                0) +
            r.get(
                "lunch_wastage_kg",
                0) +
            r.get(
                "dinner_wastage_kg",
                0),
            2)

    return {
        "range": range,
        "meal": meal,
        "series": series,
        "summary": {
            "today": {
                "breakfast": today_row.get("breakfast_wastage_kg") if today_row else None,
                "lunch": today_row.get("lunch_wastage_kg") if today_row else None,
                "dinner": today_row.get("dinner_wastage_kg") if today_row else None,
                "total": total(today_row),
            },
            "yesterday_total": total(yesterday_row),
            "last_week_same_day_total": total(last_week_row),
        },
    }


# ---------------------------------------------------------------------------
# Notifications (student + admin)
# ---------------------------------------------------------------------------
def _project_notif(doc: dict, viewer_id: Optional[str] = None) -> dict:
    out = {
        "id": doc["id"], "title": doc["title"], "body": doc["body"],
        "type": doc.get("type", "announcement"),
        "audience": doc.get("audience", "all"),
        "scheduled_for": doc.get("scheduled_for"),
        "send_at": doc.get("send_at"),
        "sent": bool(doc.get("sent", True)),
        "sent_at": doc.get("sent_at"),
        "created_at": doc["created_at"],
        "read_by_count": len(doc.get("read_by", [])),
    }
    if viewer_id is not None:
        out["read"] = viewer_id in (doc.get("read_by") or [])
    return out


@api.get("/admin/notifications/default-template")
async def admin_notification_default_template(
        _: dict = Depends(require_admin)):
    """Returns the suggested default text for the food-waste reminder."""
    return {
        "title": DEFAULT_REMINDER_TITLE,
        "body": DEFAULT_REMINDER_BODY,
    }


@api.get("/admin/notifications")
async def admin_notifications(u: dict = Depends(require_active_subscription_admin)):
    h = hostel_of(u)
    items = []
    
    async for d in notification_logs_col.find({"hostel": h}, {"_id": 0}):
        d["category"] = "PUSH"
        d["description"] = d.get("message", "Sent to students")
        d["created_at"] = d.get("delivered_at")
        d["read_status"] = True
        d["status"] = "Sent Successfully" if d.get("delivered_count", 0) > 0 else "Failed"
        
        # Parse delivered_at ISO to Indian Date & Time for UI
        if d.get("delivered_at"):
            try:
                dt = datetime.fromisoformat(d["delivered_at"])
                d["date"] = dt.strftime("%d-%m-%Y")
                d["time"] = dt.strftime("%I:%M %p")
            except:
                pass
        
        items.append(d)

    async for s in scheduled_notifications_col.find({"hostel": h, "isActive": True}, {"_id": 0}):
        s["category"] = "PUSH"
        s["description"] = s.get("message", "")
        s["read_status"] = True
        s["status"] = "Scheduled"
        
        # Parse created_at ISO to Indian Date & Time for UI fallback if scheduled time is dynamic
        if s.get("created_at"):
            try:
                dt = datetime.fromisoformat(s["created_at"])
                s["date"] = dt.strftime("%d-%m-%Y")
                s["time"] = dt.strftime("%I:%M %p")
            except:
                pass
                
        items.append(s)

    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"items": items[:100]}

@api.post("/admin/notifications/{notif_id}/read")
async def mark_admin_notif_read(notif_id: str, u: dict = Depends(require_active_subscription_admin)):
    res = await admin_notifications_col.update_one(
        {"id": notif_id, "institution_or_hostel_name": hostel_of(u)},
        {"$set": {"read_status": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@api.delete("/admin/notifications/{notif_id}")
async def delete_admin_notif(notif_id: str, u: dict = Depends(require_active_subscription_admin)):
    res = await notification_logs_col.delete_one(
        {"id": notif_id, "hostel": hostel_of(u)}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@api.post("/admin/notifications/clear")
async def clear_admin_notifs(u: dict = Depends(require_active_subscription_admin)):
    await notification_logs_col.delete_many({"hostel": hostel_of(u)})
    return {"ok": True}


# --- STUDENT NOTIFICATIONS ---
@api.get("/student/notifications")
async def student_notifications(u: dict = Depends(require_approved_student)):
    try:
        await _dispatch_scheduled_notifications()
    except Exception as e:
        logger.warning("Error dispatching scheduled notifications: %s", e)
        
    query = {"recipient_id": u["id"]}
    if u.get("admin_id"):
        query["$or"] = [{"sender_id": u["admin_id"]}, {"sender_id": {"$exists": False}}, {"sender_id": None}]
        
    items = []
    cursor = student_notifications_col.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(1000)
    async for d in cursor:
        items.append(d)
    unread = sum(1 for i in items if not i.get("read_status"))
    return {"items": items, "unread_count": unread}

@api.post("/student/notifications/{notif_id}/read")
async def mark_student_notif_read(notif_id: str, u: dict = Depends(require_approved_student)):
    res = await student_notifications_col.update_one(
        {"id": notif_id, "recipient_id": u["id"]},
        {"$set": {"read_status": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@api.delete("/student/notifications/{notif_id}")
async def delete_student_notif(notif_id: str, u: dict = Depends(require_approved_student)):
    res = await student_notifications_col.delete_one(
        {"id": notif_id, "recipient_id": u["id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@api.post("/student/notifications/clear")
async def clear_student_notifs(u: dict = Depends(require_approved_student)):
    await student_notifications_col.delete_many({"recipient_id": u["id"]})
    return {"ok": True}

@api.get("/student/notification-settings")
async def get_notification_settings(u: dict = Depends(require_approved_student)):
    settings = u.get("notification_settings", {
        "push_notifications": True,
        "in_app_notifications": True,
        "sound": True,
        "vibration": True
    })
    return settings

@api.post("/student/notification-settings")
async def update_notification_settings(payload: NotificationSettingsPayload, u: dict = Depends(require_approved_student)):
    now = datetime.now(IST).isoformat()
    await users_col.update_one(
        {"id": u["id"]},
        {"$set": {"notification_settings": payload.dict(), "updated_at": now}}
    )
    return {"ok": True}


# --- PUSH CENTRE (ADMIN -> STUDENT) ---

class PushImmediateRequest(BaseModel):
    title: str
    message: str

@api.post("/admin/notifications/push/immediate")
async def admin_push_immediate(payload: PushImmediateRequest, u: dict = Depends(require_active_subscription_admin)):
    now = now_iso()
    h = hostel_of(u)
    
    recipients = []
    async for user in users_col.find({
        "role": "student",
        "approval_status": "approved",
        "$or": [{"admin_id": u["id"]}, {"institution_or_hostel_name": h}]
    }):
        recipients.append(user["id"])
    
    docs = []
    now_dt = datetime.now(IST)
    indian_months = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"]
    indian_date = f"{now_dt.day:02d} {indian_months[now_dt.month-1]} {now_dt.year}"
    indian_day = now_dt.strftime("%A")
    indian_time = now_dt.strftime("%I:%M %p")
    for r_id in recipients:
        docs.append({
            "id": str(uuid.uuid4()),
            "recipient_id": r_id,
            "title": payload.title.strip(),
            "message": payload.message.strip(),
            "date": indian_date,
            "day": indian_day,
            "time": indian_time,
            "created_at": now,
            "read_status": False,
            "sender_id": u["id"]
        })
    
    if docs:
        await student_notifications_col.insert_many(docs)
        
    await notification_logs_col.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": u["id"],
        "hostel": h,
        "title": payload.title.strip(),
        "message": payload.message.strip(),
        "type": "Immediate",
        "delivered_count": len(recipients),
        "delivered_at": now
    })
    
    try:
        await send_push(recipients, {
            "title": payload.title.strip(), 
            "message": payload.message.strip(),
            "subtext": "MessMate",
            "action_url": "/notifications"
        })
    except Exception:
        pass
        
    return {"ok": True, "delivered_count": len(recipients)}

@api.post("/admin/notifications/push/schedule")
async def admin_push_schedule(payload: ScheduledNotificationPublic, u: dict = Depends(require_active_subscription_admin)):
    doc = payload.model_dump()
    if not doc.get("id"):
        doc["id"] = str(uuid.uuid4())
    doc["hostel"] = hostel_of(u)
    doc["adminId"] = u["id"]
    if not doc.get("created_at"):
        doc["created_at"] = now_iso()
    doc["lastSentAt"] = None
    
    await scheduled_notifications_col.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/admin/notifications/push/schedule")
async def admin_push_schedule_list(u: dict = Depends(require_active_subscription_admin)):
    items = []
    cursor = scheduled_notifications_col.find(
        {"hostel": hostel_of(u)}, {"_id": 0}
    ).sort("created_at", -1)
    async for d in cursor:
        items.append(d)
    return {"items": items}

@api.put("/admin/notifications/push/schedule/{nid}")
async def admin_push_schedule_update(nid: str, payload: ScheduledNotificationPublic, u: dict = Depends(require_active_subscription_admin)):
    updates = payload.model_dump(exclude_unset=True)
    if "id" in updates:
        del updates["id"]
        
    res = await scheduled_notifications_col.update_one(
        {"id": nid, "hostel": hostel_of(u)},
        {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    
    doc = await scheduled_notifications_col.find_one({"id": nid}, {"_id": 0})
    return doc

@api.delete("/admin/notifications/push/schedule/{nid}")
async def admin_push_schedule_delete(nid: str, u: dict = Depends(require_active_subscription_admin)):
    res = await scheduled_notifications_col.delete_one({"id": nid, "hostel": hostel_of(u)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}

@api.post("/admin/notifications/push/test")
async def admin_push_test(payload: PushImmediateRequest, u: dict = Depends(require_active_subscription_admin)):
    h = hostel_of(u)
    recipients = []
    async for user in users_col.find({"role": "student", "approval_status": "approved", "institution_or_hostel_name": h}):
        recipients.append(user["id"])
        
    docs = []
    now_dt = datetime.now(IST)
    indian_months = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"]
    indian_date = f"{now_dt.day:02d} {indian_months[now_dt.month-1]} {now_dt.year}"
    indian_day = now_dt.strftime("%A")
    indian_time = now_dt.strftime("%I:%M %p")
    for r_id in recipients:
        docs.append({
            "id": str(uuid.uuid4()),
            "recipient_id": r_id,
            "title": "[TEST] " + payload.title.strip(),
            "message": payload.message.strip(),
            "date": indian_date,
            "day": indian_day,
            "time": indian_time,
            "created_at": now_iso(),
            "read_status": False,
            "sender_id": u["id"]
        })
    
    if docs:
        await student_notifications_col.insert_many(docs)
    
    return {"ok": True, "delivered_count": len(recipients)}




# ---------------------------------------------------------------------------
# ADMIN: Students
# ---------------------------------------------------------------------------
@api.get("/admin/students/summary")
async def admin_students_summary(
        u: dict = Depends(require_active_subscription_admin)):
    h = hostel_of(u)
    base = {"role": "student", "institution_or_hostel_name": h}

    total_approved = await users_col.count_documents({**base, "approval_status": "approved"})
    total_blocked = await users_col.count_documents({**base, "approval_status": "blocked"})

    pending_base = {
        "role": "student",
        "institution_or_hostel_name": h,
        "email_verified": True}
    total_pending = await pending_requests_col.count_documents(pending_base)

    return {
        "total_students": total_approved + total_blocked + total_pending,
        "approved": total_approved,
        "pending": total_pending,
        "blocked": total_blocked,
    }


@api.get("/admin/students")
async def admin_students_list(
    u: dict = Depends(require_active_subscription_admin),
    status: Literal["all", "pending", "approved", "blocked"] = Query("all"),
):
    h = hostel_of(u)
    items = []

    if status in ("all", "approved", "blocked"):
        q: dict = {"role": "student", "institution_or_hostel_name": h}
        if status == "approved":
            q["approval_status"] = "approved"
        elif status == "blocked":
            q["approval_status"] = "blocked"

        items.extend([s async for s in users_col.find(
            q, {"_id": 0, "password_hash": 0, "push_token": 0}
        )])

    if status in ("all", "pending"):
        pq: dict = {
            "role": "student",
            "institution_or_hostel_name": h,
            "email_verified": True}
        pending_items = [s async for s in pending_requests_col.find(
            pq, {"_id": 0, "password_hash": 0, "push_token": 0}
        )]
        for p in pending_items:
            p["approval_status"] = "pending"
        items.extend(pending_items)

    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"students": items, "count": len(items)}


@api.post("/admin/students/{sid}/approve")
async def admin_approve(sid: str, u: dict = Depends(
        require_active_subscription_admin)):
    h = hostel_of(u)

    # Check capacity
    sub_status = await get_subscription_status(h)
    limit = sub_status["student_limit"]
    current = sub_status["registered_students"]
    is_trial = sub_status.get("is_trial", False) and sub_status.get(
        "status") == "TRIAL_ACTIVE"

    if not is_trial and current >= limit:
        raise HTTPException(
            status_code=400,
            detail="You have reached your subscribed student approval limit. Please upgrade your subscription to approve additional students."
        )

    pending = await pending_requests_col.find_one({"id": sid, "institution_or_hostel_name": h})
    if pending:

        pending["approval_status"] = "approved"
        pending["updated_at"] = now_iso()
        # CRITICAL FIX: Stamp the admin_id so subscription validation always
        # resolves through the correct Admin account, not a string match.
        pending["admin_id"] = u["id"]
        pending.pop("_id", None)
        await users_col.insert_one(pending)
        await pending_requests_col.delete_one({"id": sid})
        
        import asyncio
        asyncio.create_task(log_activity(None, u["id"], u["role"], h, "ADMIN_APPROVED_STUDENT", f"Student ID: {sid}"))
        return {"ok": True, "status": "approved"}

    # If it's already in users_col (e.g., previously pending or rejected)
    # CRITICAL FIX: Also stamp admin_id here so subscription validation works correctly.
    res = await users_col.update_one(
        {"id": sid, "role": "student", "institution_or_hostel_name": h},
        {"$set": {"approval_status": status_to_set, "admin_id": u["id"], "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")

    if status_to_set == "pending_capacity":
        return {
            "ok": True,
            "status": "pending_capacity",
            "message": "You have reached your subscribed student limit. Please upgrade your subscription to add more students."}

    import asyncio
    asyncio.create_task(log_activity(None, u["id"], u["role"], h, "ADMIN_APPROVED_STUDENT", f"Student ID: {sid}"))
    return {"ok": True, "status": "approved", "message": "Approved"}


@api.post("/admin/students/{sid}/reject")
async def admin_reject(sid: str, u: dict = Depends(
        require_active_subscription_admin)):
    h = hostel_of(u)

    pending = await pending_requests_col.find_one({"id": sid, "institution_or_hostel_name": h})
    if pending:
        await pending_requests_col.delete_one({"id": sid})
        import asyncio
        asyncio.create_task(log_activity(None, u["id"], u["role"], h, "ADMIN_REJECTED_STUDENT", f"Student ID: {sid}"))
        return {"ok": True}

    res = await users_col.update_one(
        {"id": sid, "role": "student", "institution_or_hostel_name": h},
        {"$set": {"approval_status": "blocked", "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
        
    import asyncio
    asyncio.create_task(log_activity(None, u["id"], u["role"], h, "ADMIN_REJECTED_STUDENT", f"Student ID: {sid}"))
    return {"ok": True}

@api.post("/admin/students/{sid}/block")
async def admin_block(sid: str, u: dict = Depends(
        require_active_subscription_admin)):
    h = hostel_of(u)

    res = await users_col.update_one(
        {"id": sid, "role": "student", "institution_or_hostel_name": h},
        {"$set": {"approval_status": "blocked", "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Invalidate their current session so they are kicked out
    await rotate_session(sid)
        
    import asyncio
    asyncio.create_task(log_activity(None, u["id"], u["role"], h, "ADMIN_BLOCKED_STUDENT", f"Student ID: {sid}"))
    return {"ok": True, "message": "Student blocked"}

@api.post("/admin/students/{sid}/remove")
async def admin_remove(sid: str, u: dict = Depends(
        require_active_subscription_admin)):
    h = hostel_of(u)

    # First check pending
    pending = await pending_requests_col.find_one({"id": sid, "institution_or_hostel_name": h})
    if pending:
        await pending_requests_col.delete_one({"id": sid})
        import asyncio
        asyncio.create_task(log_activity(None, u["id"], u["role"], h, "ADMIN_REMOVED_STUDENT", f"Student ID: {sid} (Pending)"))
        return {"ok": True, "message": "Student removed"}

    res = await users_col.delete_one(
        {"id": sid, "role": "student", "institution_or_hostel_name": h}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    await rotate_session(sid)
    
    # Delete all orphaned student records
    try:
        await daily_plans_col.delete_many({"student_id": sid})
        await menu_reactions_col.delete_many({"student_id": sid})
        await feedback_col.delete_many({"student_id": sid})
        await push_tokens_col.delete_many({"user_id": sid})
        await student_notifications_col.delete_many({"recipient_id": sid})
    except Exception as e:
        logger.error(f"Failed to clean up orphaned records for removed student {sid}: {e}", exc_info=True)
        
    import asyncio
    asyncio.create_task(log_activity(None, u["id"], u["role"], h, "ADMIN_REMOVED_STUDENT", f"Student ID: {sid}"))
    return {"ok": True, "message": "Student removed"}


async def _aggregate_meal(
        hostel: str,
        meal: MealType,
        target_date: str,
        menu: dict) -> dict:
    eating = 0
    not_eating = 0
    item_counts: Dict[str, int] = defaultdict(int)
    reason_counts: Dict[str, int] = defaultdict(int)
    custom_counts: Dict[str, int] = defaultdict(int)

    day = day_of_week(date.fromisoformat(target_date))
    menu_items = menu.get(f"{meal}_items", []) if menu else []
    item_multipliers: Dict[str, float] = {it: 0.0 for it in menu_items}

    student_reactions = {}
    async for r in menu_reactions_col.find(
        {"hostel": hostel, "day": day, "meal_type": meal},
        {"_id": 0, "student_id": 1, "reaction": 1}
    ):
        student_reactions[r["student_id"]] = r["reaction"]

    # Track which students submitted a plan for this date
    responded_student_ids: set = set()
    async for p in daily_plans_col.find(
        {"hostel": hostel, "date": target_date},
        {"_id": 0, meal: 1, "student_id": 1},
    ):
        mp = p.get(meal) or {}
        st = mp.get("status")
        student_id = p.get("student_id")
        responded_student_ids.add(student_id)
        reaction = student_reactions.get(student_id, "no_response")
        selected = mp.get("selected_items") or []

        if st == "ON":
            eating += 1
            for it in selected:
                item_counts[it] += 1

            if selected:
                for it in menu_items:
                    if it in selected:
                        item_multipliers[it] += 1.0
                    else:
                        item_multipliers[it] += 0.50
            else:
                if reaction == "like":
                    val = 1.0
                elif reaction == "dislike":
                    val = 0.70
                else:
                    val = 0.80
                for it in menu_items:
                    item_multipliers[it] += val

        elif st == "OFF":
            not_eating += 1
            r = (mp.get("reason_if_off") or "").strip()
            if r:
                reason_counts["Other" if r.lower(
                ).startswith("other") else r] += 1

            for it in menu_items:
                item_multipliers[it] += 0.50

        ca = mp.get("custom_answer")
        if ca:
            custom_counts[ca] += 1

    # Students with NO plan entry at all → treat as 70% for every menu item
    async for s in users_col.find(
        {"institution_or_hostel_name": hostel, "role": "student", "approval_status": "approved"},
        {"_id": 0, "id": 1},
    ):
        if s["id"] not in responded_student_ids:
            for it in menu_items:
                item_multipliers[it] += 0.70

    like = sum(1 for r in student_reactions.values() if r == "like")
    dislike = sum(1 for r in student_reactions.values() if r == "dislike")
    tot = like + dislike
    items_rows = []
    seen = set()
    for it in menu_items:
        items_rows.append({"item_name": it, "count": item_counts.get(it, 0)})
        seen.add(it)
    for k, v in item_counts.items():
        if k not in seen:
            items_rows.append({"item_name": k, "count": v})
            if k not in item_multipliers:
                item_multipliers[k] = float(v)

    return {
        "menu_items": menu_items,
        "custom_question": menu.get(f"{meal}_custom_question") if menu else None,
        "eating_count": eating, "not_eating_count": not_eating,
        "like_count": like, "dislike_count": dislike,
        "like_pct": round(like / tot * 100, 1) if tot else None,
        "dislike_pct": round(dislike / tot * 100, 1) if tot else None,
        "item_counts": items_rows,
        "item_multipliers": item_multipliers,
        "reason_counts": [{"reason": k, "count": v} for k, v in
                          sorted(reason_counts.items(), key=lambda kv: -kv[1])],
        "custom_answer_counts": [{"answer": k, "count": v} for k, v in
                                 sorted(custom_counts.items(), key=lambda kv: -kv[1])],
    }


@api.get("/admin/today")
async def admin_today(u: dict = Depends(require_active_subscription_admin)):
    h = hostel_of(u)
    today = today_iso()
    day = day_of_week(date.fromisoformat(today))
    menu = await menus_col.find_one({"hostel": h, "day": day}, {"_id": 0}) or {}
    return {
        "date": today, "day": day,
        "total_responses": await daily_plans_col.count_documents(
            {"hostel": h, "date": today}
        ),
        "breakfast": await _aggregate_meal(h, "breakfast", today, menu),
        "lunch": await _aggregate_meal(h, "lunch", today, menu),
        "dinner": await _aggregate_meal(h, "dinner", today, menu),
    }


@api.get("/admin/feedback")
async def admin_feedback(
    u: dict = Depends(require_active_subscription_admin),
    days: int = Query(
        7,
        ge=1,
        le=90)):
    since = (
        date.fromisoformat(
            today_iso()) -
        timedelta(
            days=days -
            1)).isoformat()
    items = [r async for r in feedback_col.find(
        {"hostel": hostel_of(u), "date": {"$gte": since}},
        {"_id": 0, "id": 1, "date": 1, "feedback_text": 1, "created_at": 1},
    ).sort("created_at", -1)]
    return {"items": items, "count": len(items)}


# ---------------------------------------------------------------------------
# ADMIN: Necessary Info
# ---------------------------------------------------------------------------
def _proj_ni(d: dict) -> dict:
    return {
        "id": d["id"],
        "item_name": d["item_name"],
        "meal_type": d["meal_type"],
        "quantity_per_person": d["quantity_per_person"],
        "unit": d["unit"],
        "price_per_unit": d["price_per_unit"],
        "price_unit": d["price_unit"],
        "updated_at": d.get("updated_at"),
    }


@api.get("/admin/necessary-info")
async def admin_ni_list(u: dict = Depends(require_active_subscription_admin)):
    items = [_proj_ni(r) async for r in necessary_info_col.find(
        {"hostel": hostel_of(u)}, {"_id": 0}
    ).sort("item_name", 1)]
    return {"items": items, "count": len(items)}


@api.post("/admin/necessary-info", status_code=201)
async def admin_ni_create(payload: NecessaryItemInput,
                          u: dict = Depends(require_active_subscription_admin)):
    h = hostel_of(u)
    if await necessary_info_col.find_one(
        {"hostel": h, "item_name": payload.item_name, "meal_type": payload.meal_type},
        {"_id": 0, "id": 1},
    ):
        raise HTTPException(status_code=400,
                            detail="Item already exists for this meal")
    now = now_iso()
    doc = {"id": str(uuid.uuid4()), "hostel": h, **payload.model_dump(),
           "created_at": now, "updated_at": now}
    await necessary_info_col.insert_one(doc)
    doc.pop("_id", None)
    return _proj_ni(doc)


@api.put("/admin/necessary-info/{iid}")
async def admin_ni_update(
        iid: str,
        payload: NecessaryItemInput,
        u: dict = Depends(require_active_subscription_admin)):
    res = await necessary_info_col.update_one(
        {"id": iid, "hostel": hostel_of(u)},
        {"$set": {**payload.model_dump(), "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    doc = await necessary_info_col.find_one({"id": iid}, {"_id": 0})
    return _proj_ni(doc) if doc else {"ok": True}


@api.delete("/admin/necessary-info/{iid}")
async def admin_ni_delete(iid: str, u: dict = Depends(
        require_active_subscription_admin)):
    res = await necessary_info_col.delete_one({"id": iid, "hostel": hostel_of(u)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# ADMIN: Menus
# ---------------------------------------------------------------------------
@api.get("/admin/menus")
async def admin_menu_list(u: dict = Depends(
        require_active_subscription_admin)):
    h = hostel_of(u)
    rows = []
    for d in DAYS:
        m = await menus_col.find_one({"hostel": h, "day": d}, {"_id": 0})
        rows.append(
            project_menu(m) if m else {
                "day": d,
                "breakfast_items": [],
                "lunch_items": [],
                "dinner_items": [],
                "breakfast_custom_question": None,
                "lunch_custom_question": None,
                "dinner_custom_question": None,
            })
    return {"days": rows}


@api.put("/admin/menus/{day}")
async def admin_menu_upsert(
        day: str,
        payload: MenuUpsert,
        u: dict = Depends(require_active_subscription_admin)):
    if day not in DAYS:
        raise HTTPException(status_code=400, detail="Invalid day")
    h = hostel_of(u)
    now = now_iso()
    body = payload.model_dump()
    await menus_col.update_one(
        {"hostel": h, "day": day},
        {
            "$set": {**body, "updated_at": now, "day": day, "hostel": h},
            "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now},
        },
        upsert=True,
    )
    saved = await menus_col.find_one({"hostel": h, "day": day}, {"_id": 0})
    return project_menu(saved) if saved else {"ok": True}


# ---------------------------------------------------------------------------
# ADMIN: Dashboard
# ---------------------------------------------------------------------------
@api.get("/admin/dashboard")
async def admin_dashboard(
    u: dict = Depends(require_active_subscription_admin),
    for_: Literal["today", "tomorrow"] = Query("today", alias="for"),
):
    h = hostel_of(u)
    base = date.fromisoformat(today_iso())
    target_date = (
        base +
        timedelta(
            days=1)).isoformat() if for_ == "tomorrow" else base.isoformat()
    day = day_of_week(date.fromisoformat(target_date))
    menu = await menus_col.find_one({"hostel": h, "day": day}, {"_id": 0}) or {}

    ni_lookup: Dict[str, dict] = {}
    async for r in necessary_info_col.find({"hostel": h}, {"_id": 0}):
        ni_lookup[f"{r['meal_type']}:{r['item_name'].lower()}"] = r

    out: Dict[str, Any] = {"date": target_date,
                           "day": day, "for": for_, "meals": {}}
    most = {"item": None, "count": -1}
    least = {"item": None, "count": 10**9}

    for meal in ("breakfast", "lunch", "dinner"):
        # type: ignore[arg-type]
        agg = await _aggregate_meal(h, meal, target_date, menu)
        items_out, warnings = [], []
        menu_items = menu.get(f"{meal}_items", []) if menu else []
        if not menu_items:
            warnings.append(
                f"Menu not added for {meal}. Add menu in Necessary Info.")
        for row in agg["item_counts"]:
            ni = ni_lookup.get(f"{meal}:{row['item_name'].lower()}")
            if not ni:
                warnings.append(
                    f"Quantity per person not added for {row['item_name']}."
                )
                items_out.append({
                    "item_name": row["item_name"], "preference_count": row["count"],
                    "quantity_per_person": None, "unit": None,
                    "suggested": None, "display": None,
                })
            else:
                multiplier = agg.get(
                    "item_multipliers", {}).get(
                    row["item_name"], float(
                        row["count"]))
                raw = multiplier * float(ni["quantity_per_person"])
                items_out.append({
                    "item_name": row["item_name"], "preference_count": row["count"],
                    "quantity_per_person": ni["quantity_per_person"], "unit": ni["unit"],
                    "suggested": round(raw, 2), "display": display_quantity(raw, ni["unit"]),
                })
            if row["count"] > most["count"]:
                most = {"item": row["item_name"], "count": row["count"]}
            if 0 < row["count"] < least["count"]:
                least = {"item": row["item_name"], "count": row["count"]}

        if not agg["item_counts"] and not warnings:
            warnings.append(
                "No student responses yet." if for_ == "today"
                else "No preferences submitted for tomorrow yet."
            )

        out["meals"][meal] = {
            "menu_items": menu_items, "eating_count": agg["eating_count"],
            "not_eating_count": agg["not_eating_count"],
            "items": items_out, "warnings": warnings,
        }

    if least["count"] == 10**9:
        least = {"item": None, "count": 0}

    out["summary"] = {
        "breakfast_eating": out["meals"]["breakfast"]["eating_count"],
        "lunch_eating": out["meals"]["lunch"]["eating_count"],
        "dinner_eating": out["meals"]["dinner"]["eating_count"],
        "total_responses": await daily_plans_col.count_documents(
            {"hostel": h, "date": target_date}
        ),
        "most_demanded": most if most["item"] else None,
        "least_demanded": least if least["item"] else None,
    }
    return out


# ---------------------------------------------------------------------------
# ADMIN: Wastage
# ---------------------------------------------------------------------------
async def _price_for(hostel: str, item_name: str, meal: str) -> Optional[dict]:
    return await necessary_info_col.find_one(
        {"hostel": hostel, "item_name": item_name, "meal_type": meal}, {"_id": 0}
    )


async def _compute_wastage_doc(
        hostel: str,
        target_date: str,
        payload: WastageUpsert) -> dict:
    out: Dict[str, Any] = {
        "hostel": hostel, "date": target_date,
        "breakfast_items": [], "lunch_items": [], "dinner_items": [],
        "breakfast_wastage_kg": 0.0, "lunch_wastage_kg": 0.0, "dinner_wastage_kg": 0.0,
        "breakfast_loss": 0.0, "lunch_loss": 0.0, "dinner_loss": 0.0,
    }
    for meal, items in (("breakfast", payload.breakfast_items),
                        ("lunch", payload.lunch_items),
                        ("dinner", payload.dinner_items)):
        kg = 0.0
        loss = 0.0
        rich = []
        for it in items:
            price = it.price_per_unit
            pu = it.price_unit
            if price is None or pu is None:
                ni = await _price_for(hostel, it.item_name, meal)
                if ni:
                    price = float(ni["price_per_unit"])
                    pu = ni["price_unit"]
            loss_item = 0.0
            if price is not None and pu is not None:
                loss_item = round(
                    normalize_to_price_unit(
                        it.quantity, it.unit, pu) * price, 2)
            kg += to_kg_equiv(it.quantity, it.unit)
            loss += loss_item
            rich.append({"item_name": it.item_name,
                         "quantity": float(it.quantity),
                         "unit": it.unit,
                         "price_per_unit": price,
                         "price_unit": pu,
                         "loss": loss_item,
                         })
        out[f"{meal}_items"] = rich
        out[f"{meal}_wastage_kg"] = round(kg, 2)
        out[f"{meal}_loss"] = round(loss, 2)
    item_loss_total = out["breakfast_loss"] + \
        out["lunch_loss"] + out["dinner_loss"]
    if payload.manual_total_cost is not None:
        out["manual_total_cost"] = round(float(payload.manual_total_cost), 2)
        out["total_loss"] = round(
            item_loss_total +
            float(
                payload.manual_total_cost),
            2)
    else:
        out["total_loss"] = round(item_loss_total, 2)
    out["item_loss_total"] = round(item_loss_total, 2)
    return out


@api.put("/admin/wastage/{target_date}")
async def admin_wastage_upsert(
        target_date: str,
        payload: WastageUpsert,
        u: dict = Depends(require_active_subscription_admin)):
    try:
        date.fromisoformat(target_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date")
    h = hostel_of(u)
    body = await _compute_wastage_doc(h, target_date, payload)
    now = now_iso()
    await wastage_col.update_one(
        {"hostel": h, "date": target_date},
        {"$set": {**body, "updated_at": now},
         "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now}},
        upsert=True,
    )
    saved = await wastage_col.find_one({"hostel": h, "date": target_date}, {"_id": 0})
    return {"ok": True, "wastage": saved}


@api.get("/admin/wastage/today")
async def admin_wastage_today(
        u: dict = Depends(require_active_subscription_admin)):
    h = hostel_of(u)
    today = today_iso()
    td = date.fromisoformat(today)
    today_doc = await wastage_col.find_one({"hostel": h, "date": today}, {"_id": 0})
    yesterday_doc = await wastage_col.find_one(
        {"hostel": h, "date": (td - timedelta(days=1)).isoformat()}, {"_id": 0}
    )
    last_week_doc = await wastage_col.find_one(
        {"hostel": h, "date": (td - timedelta(days=7)).isoformat()}, {"_id": 0}
    )
    start = (td - timedelta(days=30)).isoformat()
    losses = [r["total_loss"] async for r in wastage_col.find(
        {"hostel": h, "date": {"$gte": start, "$lt": today},
         "total_loss": {"$exists": True, "$gt": 0}},
        {"_id": 0, "total_loss": 1},
    )]
    avg = round(sum(losses) / len(losses), 2) if losses else None
    today_loss = (today_doc or {}).get("total_loss")
    saved = round(
        avg - today_loss,
        2) if avg is not None and today_loss is not None else None
    return {
        "date": today,
        "today": today_doc,
        "yesterday": yesterday_doc,
        "last_week_same_day": last_week_doc,
        "average_loss_30d": avg,
        "saved_amount_vs_avg": saved,
    }


@api.get("/admin/wastage/trend")
async def admin_wastage_trend(
    u: dict = Depends(require_active_subscription_admin),
    range: int = Query(7, ge=1, le=365),
    meal: Literal["all", "breakfast", "lunch", "dinner"] = Query("all"),
):
    h = hostel_of(u)
    today = date.fromisoformat(today_iso())
    start = today - timedelta(days=range - 1)
    rows = [r async for r in wastage_col.find(
        {"hostel": h, "date": {"$gte": start.isoformat(), "$lte": today.isoformat()}},
        {"_id": 0},
    ).sort("date", 1)]
    w_series, s_series, c_series = [], [], []
    losses: List[float] = []
    for r in rows:
        if meal == "all":
            wv = round(
                r.get(
                    "breakfast_wastage_kg",
                    0) +
                r.get(
                    "lunch_wastage_kg",
                    0) +
                r.get(
                    "dinner_wastage_kg",
                    0),
                2)
            ls = r.get("total_loss") or (
                r.get(
                    "breakfast_loss",
                    0) +
                r.get(
                    "lunch_loss",
                    0) +
                r.get(
                    "dinner_loss",
                    0))
        else:
            wv = r.get(f"{meal}_wastage_kg", 0)
            ls = r.get(f"{meal}_loss", 0)
        w_series.append({"date": r["date"], "value": wv})
        c_series.append({"date": r["date"], "value": round(float(ls or 0), 2)})
        if losses:
            saved = round(sum(losses) / len(losses) - float(ls or 0), 2)
        else:
            saved = 0.0
        s_series.append({"date": r["date"], "value": saved})
        if ls:
            losses.append(float(ls))
    return {
        "range": range, "meal": meal,
        "wastage_series": w_series,
        "saved_series": s_series,
        "cost_series": c_series,
    }


# ---------------------------------------------------------------------------
# ADMIN: Settings (per hostel)
# ---------------------------------------------------------------------------
SETTINGS_DEFAULTS = {
    "default_meal_state": "ON",
    "default_like_dislike_state": "no_response",
    "default_preference_state": "none",
    "notifications_enabled": True,
    "language": "English",
    "reminder_times": ["07:00", "11:30", "18:00"],
}


@api.get("/admin/settings")
async def admin_settings_get(u: dict = Depends(
        require_active_subscription_admin)):
    h = hostel_of(u)
    doc = await settings_col.find_one({"hostel": h}, {"_id": 0})
    if not doc:
        doc = {
            "id": h,
            "hostel": h,
            **SETTINGS_DEFAULTS,
            "updated_at": now_iso()}
        await settings_col.insert_one(doc)
        doc.pop("_id", None)
    return doc


@api.put("/admin/settings")
async def admin_settings_put(
        payload: AppSettingsInput,
        u: dict = Depends(require_admin)):
    h = hostel_of(u)
    body = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not body:
        raise HTTPException(status_code=400, detail="No fields to update")
    body["updated_at"] = now_iso()
    body["hostel"] = h
    await settings_col.update_one(
        {"hostel": h},
        {"$set": body, "$setOnInsert": {"id": h, **{k: v for k, v in SETTINGS_DEFAULTS.items() if k not in body}}},
        upsert=True,
    )
    return await settings_col.find_one({"hostel": h}, {"_id": 0})


# ---------------------------------------------------------------------------
# Startup: indexes & migrations only — NO seed data (production-ready)
# ---------------------------------------------------------------------------
async def _ensure_indexes_and_migrate():
    """Create indexes for hostel-scoped collections. Idempotent."""
    await users_col.create_index("id", unique=True)
    # New: email is the global unique identifier.
    # Use a partial filter so legacy/no-email rows don't conflict.
    try:
        idxs = await users_col.index_information()
        if "mobile_or_user_id_1_institution_or_hostel_name_1" in idxs:
            await users_col.drop_index("mobile_or_user_id_1_institution_or_hostel_name_1")
        if "email_1" not in idxs:
            await users_col.create_index(
                "email",
                unique=True,
                partialFilterExpression={"email": {"$exists": True, "$type": "string"}},
                name="email_1",
            )
    except Exception:
        pass

    try:
        idxs = await pending_requests_col.index_information()
        if "email_1" not in idxs:
            await pending_requests_col.create_index(
                "email",
                unique=True,
                partialFilterExpression={"email": {"$exists": True, "$type": "string"}},
                name="email_1",
            )
    except Exception:
        pass
    # menus
    try:
        idxs = await menus_col.index_information()
        if "day_1" in idxs:
            await menus_col.drop_index("day_1")
    except Exception:
        pass
    await menus_col.create_index([("hostel", 1), ("day", 1)], unique=True)
    # daily_plans
    await daily_plans_col.create_index(
        [("student_id", 1), ("date", 1)], unique=True
    )
    await daily_plans_col.create_index([("hostel", 1), ("date", 1)])
    # menu_reactions
    await menu_reactions_col.create_index(
        [("student_id", 1), ("day", 1), ("meal_type", 1)], unique=True
    )
    # feedback
    await feedback_col.create_index([("hostel", 1), ("date", -1)])
    # wastage
    try:
        idxs = await wastage_col.index_information()
        if "date_1" in idxs:
            await wastage_col.drop_index("date_1")
    except Exception:
        pass
    await wastage_col.create_index([("hostel", 1), ("date", 1)], unique=True)
    # necessary_info
    try:
        idxs = await necessary_info_col.index_information()
        if "item_name_1_meal_type_1" in idxs:
            await necessary_info_col.drop_index("item_name_1_meal_type_1")
    except Exception:
        pass
    await necessary_info_col.create_index(
        [("hostel", 1), ("item_name", 1), ("meal_type", 1)], unique=True
    )
    # app_settings
    try:
        idxs = await settings_col.index_information()
        if "id_1" in idxs:
            await settings_col.drop_index("id_1")
    except Exception:
        pass
    await settings_col.create_index("hostel", unique=True)
    # notifications
    await notifications_col.create_index([("hostel", 1), ("created_at", -1)])
    # email otps
    await email_otps_col.create_index(
        [("email", 1), ("purpose", 1)], unique=True
    )
    await email_otps_col.create_index("expires_at")
    # push tokens
    await push_tokens_col.create_index(
        [("user_id", 1), ("device_token", 1)], unique=True
    )
    await push_tokens_col.create_index([("hostel", 1), ("role", 1)])

    # Subscription & Billing indexes
    await subscriptions_col.create_index("institution_or_hostel_name", unique=True)
    await transactions_col.create_index([("institution_or_hostel_name", 1), ("created_at", -1)])
    await invoices_col.create_index([("institution_or_hostel_name", 1), ("created_at", -1)])
    await subscription_events_col.create_index([("institution_or_hostel_name", 1), ("event_date", -1)])

    # Activity logs
    await activity_logs_col.create_index([("institution", 1), ("timestamp", -1)])
    await activity_logs_col.create_index("user_id")

    logger.info("MessMate API started. Connected to DB.")

    # Drop legacy users unique-on-mobile-only if present
    try:
        idxs = await users_col.index_information()
        if "mobile_or_user_id_1" in idxs:
            await users_col.drop_index("mobile_or_user_id_1")
    except Exception:
        pass

    # -------------------------------------------------------------------------
    # ONE-TIME MIGRATION: Backfill admin_id on approved students that were
    # approved before this fix was deployed. This ensures all existing students
    # can log in immediately without re-approval.
    # -------------------------------------------------------------------------
    try:
        # Build a mapping of institution_name → admin_id for fast lookup
        admin_map: dict = {}
        async for admin_doc in users_col.find({"role": "admin"}, {"_id": 0, "id": 1, "institution_or_hostel_name": 1}):
            inst = admin_doc.get("institution_or_hostel_name")
            if inst and inst not in admin_map:
                admin_map[inst] = admin_doc["id"]

        if admin_map:
            backfill_count = 0
            async for student in users_col.find(
                {"role": "student", "approval_status": "approved", "admin_id": {"$exists": False}},
                {"_id": 0, "id": 1, "institution_or_hostel_name": 1}
            ):
                inst = student.get("institution_or_hostel_name", "")
                mapped_admin_id = admin_map.get(inst)
                if mapped_admin_id:
                    await users_col.update_one(
                        {"id": student["id"]},
                        {"$set": {"admin_id": mapped_admin_id}}
                    )
                    backfill_count += 1

            if backfill_count:
                logger.info(
                    "admin_id backfill migration: stamped admin_id on %d approved student(s).",
                    backfill_count
                )
    except Exception as e:
        logger.warning("admin_id backfill migration failed (non-fatal): %s", e, exc_info=True)


SCHEDULER_INTERVAL_SEC = int(
    os.environ.get(
        "NOTIF_SCHEDULER_INTERVAL_SEC",
        "60"))
_scheduler_task: Optional[asyncio.Task] = None


async def _dispatch_scheduled_notifications() -> int:
    """Find active scheduled notifications whose time and day match the current time.
    Dispatch them to students and log the delivery.
    """
    now_dt = datetime.now(IST)
    today_str = now_dt.date().isoformat()
    current_time_str = now_dt.strftime("%H:%M")
    current_day = now_dt.strftime("%A") # e.g. "Monday"
    
    cursor = scheduled_notifications_col.find({
        "isActive": True,
        "scheduledTime": current_time_str
    })
    
    dispatched = 0
    async for doc in cursor:
        last_sent = doc.get("lastSentAt")
        # Prevent double sending in the same minute
        if last_sent and last_sent[:16] == now_dt.isoformat()[:16]:
            continue
            
        repeat_option = doc.get("repeatOption")
        days_selection = doc.get("daysSelection", [])
        
        should_send = False
        
        if repeat_option == "Send Once":
            should_send = True
        elif repeat_option == "Repeat Every Selected Day":
            if current_day in days_selection:
                should_send = True
        elif repeat_option == "Repeat Weekly":
            if current_day in days_selection:
                should_send = True
        else:
            # Fallback for old 'Weekly' or 'Daily'
            should_send = True

        if not should_send:
            continue
            
        # Send it!
        try:
            h = doc["hostel"]
            admin_id_val = doc.get("adminId")
            recipients = []
            user_query = {"role": "student", "approval_status": "approved"}
            if admin_id_val:
                user_query["$or"] = [{"admin_id": admin_id_val}, {"institution_or_hostel_name": h}]
            else:
                user_query["institution_or_hostel_name"] = h
            async for user in users_col.find(user_query):
                recipients.append(user["id"])
            
            if recipients:
                docs = []
                now = now_iso()
                indian_months = ["January","February","March","April","May","June",
                                 "July","August","September","October","November","December"]
                indian_date = f"{now_dt.day:02d} {indian_months[now_dt.month-1]} {now_dt.year}"
                indian_day = now_dt.strftime("%A")
                indian_time = now_dt.strftime("%I:%M %p")
                for r_id in recipients:
                    docs.append({
                        "id": str(uuid.uuid4()),
                        "recipient_id": r_id,
                        "title": doc["title"],
                        "message": doc["message"],
                        "date": indian_date,
                        "day": indian_day,
                        "time": indian_time,
                        "created_at": now,
                        "read_status": False,
                        "sender_id": doc.get("adminId")
                    })
                
                await student_notifications_col.insert_many(docs)
                
                await notification_logs_col.insert_one({
                    "id": str(uuid.uuid4()),
                    "admin_id": doc.get("adminId"),
                    "hostel": h,
                    "title": doc["title"],
                    "message": doc["message"],
                    "type": "Scheduled",
                    "delivered_count": len(recipients),
                    "delivered_at": now
                })
                
                try:
                    await send_push(
                        recipients,
                        {"title": doc["title"], "message": doc["message"],
                         "subtext": "MessMate", "action_url": "/notifications"},
                        idempotency_key=str(uuid.uuid4()),
                    )
                except Exception as e:
                    logger.warning("scheduled push failed (%s): %s", doc.get("id"), e, exc_info=True)
            
            # Update lastSentAt
            await scheduled_notifications_col.update_one(
                {"id": doc["id"]},
                {
                    "$set": {"lastSentAt": now_dt.isoformat()},
                }
            )
            dispatched += 1
            
            # If One Time, mark inactive
            if repeat_option == "Send Once":
                await scheduled_notifications_col.update_one(
                    {"id": doc["id"]},
                    {"$set": {"isActive": False}}
                )
                
        except Exception as e:
            logger.warning(
                "scheduler dispatch failed for %s: %s",
                doc.get("id"),
                e, exc_info=True)
    return dispatched


async def _scheduler_loop() -> None:
    """Long-running background task that polls for due notifications."""
    logger.info(
        "Notification scheduler started (interval=%ss)",
        SCHEDULER_INTERVAL_SEC)
    while True:
        try:
            await _dispatch_scheduled_notifications()
        except asyncio.CancelledError:
            raise
        except Exception as e:  # pragma: no cover — defensive
            logger.warning("scheduler loop error (non-fatal): %s", e, exc_info=True)
        await asyncio.sleep(SCHEDULER_INTERVAL_SEC)


@app.on_event("startup")
async def on_startup():
    await _ensure_indexes_and_migrate()
    if GMAIL_CONFIGURED:
        logger.info("MessMate API ready — Gmail API email OTP active")
    else:
        logger.info(
            "MessMate API ready — Gmail API NOT configured. OTPs are logged to console (dev mode).")
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_scheduler_loop())


@app.on_event("shutdown")
async def on_shutdown():
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except (asyncio.CancelledError, Exception):
            pass
    client.close()
    try:
        if _push_client is not None:
            await _push_client.aclose()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Mount + CORS
# ---------------------------------------------------------------------------
app.include_router(api)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Global exception handler for uncaught errors
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500, content={
            "detail": "An unexpected error occurred. Please try again later."})


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        logger.info(f"[API Request] {request.method} {request.url.path}")
        start_time = time.time()
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)

            # Log slow requests (>500ms)
            if process_time > 0.5:
                logger.warning(
                    f"SLOW_REQUEST: {request.method} {request.url.path} took {process_time:.4f}s - Status: {response.status_code}"
                )
            else:
                logger.info(
                    f"[API Response] {request.method} {request.url.path} completed in {process_time:.4f}s - Status: {response.status_code}"
                )

            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(f"[API Error] {request.method} {request.url.path} failed after {process_time:.4f}s with exception: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal Server Error"},
                headers={"Access-Control-Allow-Origin": "*"}
            )


app.add_middleware(PerformanceMiddleware)


