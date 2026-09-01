"""Iteration 9 — Today/Tomorrow toggle backend tests.

Verifies:
- GET /api/student/today (no query)           → today's date+day+menu+plan (regression)
- GET /api/student/today?for=tomorrow         → date = today+1, plan for tomorrow
- PUT /api/student/today with date=<tomorrow> → upserts; subsequent GET reflects it
- GET /api/admin/dashboard (no query)         → today aggregation
- GET /api/admin/dashboard?for=tomorrow       → counts only tomorrow's plans
- ?for=invalid                                → 422 (FastAPI Query Literal validation)
- Regression check on a handful of related endpoints.

Re-uses helper pattern from test_iteration8_email_otp.py: register, then
overwrite the email_otps doc with a known OTP hash, then verify-email.
"""
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from passlib.context import CryptContext
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = "http://127.0.0.1:8000"
API = f"{BASE_URL}/api"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_mc = MongoClient(MONGO_URL)
_db = _mc[DB_NAME]

KNOWN_OTP = "424242"
WEEKDAY = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


# --- helpers ---------------------------------------------------------------


def _unique_email(prefix="it9"):
    return f"test_{prefix}_{uuid.uuid4().hex[:10]}@example.com"


def _set_otp_hash(email: str, purpose: str, otp: str = KNOWN_OTP):
    now = datetime.now(timezone.utc)
    for db_name in ["messmate", "messmate_db2", "messmate_db3"]:
        db = _mc[db_name]
        res = db.email_otps.update_one(
            {"email": email, "purpose": purpose},
            {"$set": {
                "otp_hash": _pwd.hash(otp),
                "attempts": 0,
                "created_at": now.isoformat(),
                "expires_at": (now + timedelta(minutes=5)).isoformat(),
            }},
        )
        if res.matched_count > 0:
            return db.email_otps.find_one({"email": email, "purpose": purpose})
    return None


def _today_iso():
    return date.today().isoformat()


def _tomorrow_iso():
    return (date.today() + timedelta(days=1)).isoformat()


def _weekday_for(iso: str):
    return WEEKDAY[date.fromisoformat(iso).weekday()]


# --- fixtures --------------------------------------------------------------


@pytest.fixture
def created_emails():
    bag = set()
    hostels = set()
    yield {"emails": bag, "hostels": hostels}
    for db_name in ["messmate", "messmate_db2", "messmate_db3"]:
        db = _mc[db_name]
        if bag:
            db.users.delete_many({"email": {"$in": list(bag)}})
            db.email_otps.delete_many({"email": {"$in": list(bag)}})
        if hostels:
            db.daily_plans.delete_many({"hostel": {"$in": list(hostels)}})
            db.menus.delete_many({"hostel": {"$in": list(hostels)}})
            db.necessary_info.delete_many({"hostel": {"$in": list(hostels)}})


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register_verify(api, email, *, role="student", hostel="TEST_It9_Hostel"):
    r = api.post(f"{API}/auth/register", json={
        "full_name": f"User {email}",
        "email": email,
        "password": "secret123",
        "institution_or_hostel_name": hostel,
        "role": role,
    })
    assert r.status_code == 201, r.text
    _set_otp_hash(email, "registration", KNOWN_OTP)
    r2 = api.post(f"{API}/auth/verify-email", json={"email": email, "otp": KNOWN_OTP})
    assert r2.status_code == 200, r2.text
    data = r2.json()
    if "access_token" in data:
        return data["access_token"]
    # If pending approval, approve across databases and login
    for db_name in ["messmate", "messmate_db2", "messmate_db3"]:
        db = _mc[db_name]
        p = db.pending_requests.find_one({"email": email})
        if p:
            p_dict = dict(p)
            p_dict["approval_status"] = "approved"
            p_dict.pop("_id", None)
            db.users.update_one({"email": email}, {"$set": p_dict}, upsert=True)
            db.pending_requests.delete_one({"email": email})
    r_login = api.post(f"{API}/auth/login", json={"email": email, "password": "secret123"})
    if r_login.status_code == 200:
        return r_login.json()["access_token"]
    return None


@pytest.fixture
def admin_pair(api, created_emails):
    """Create an admin (auto-approved on a fresh hostel) + an approved student in that same hostel."""
    hostel = f"TEST_It9_Hostel_{uuid.uuid4().hex[:6]}"
    created_emails["hostels"].add(hostel)

    adm_email = _unique_email("admin")
    created_emails["emails"].add(adm_email)
    adm_token = _register_verify(api, adm_email, role="admin", hostel=hostel)

    stu_email = _unique_email("student")
    created_emails["emails"].add(stu_email)
    stu_token = _register_verify(api, stu_email, role="student", hostel=hostel)
    # First admin pre-existed → student starts as pending. Approve via DB across all test databases.
    for db_name in ["messmate", "messmate_db2", "messmate_db3"]:
        db = _mc[db_name]
        db.users.update_one({"email": stu_email}, {"$set": {"approval_status": "approved"}})
        p = db.pending_requests.find_one({"email": stu_email})
        if p:
            p_dict = dict(p)
            p_dict["approval_status"] = "approved"
            p_dict.pop("_id", None)
            db.users.update_one({"email": stu_email}, {"$set": p_dict}, upsert=True)
            db.pending_requests.delete_one({"email": stu_email})

    return {
        "hostel": hostel,
        "admin_token": adm_token,
        "admin_email": adm_email,
        "student_token": stu_token,
        "student_email": stu_email,
    }


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# --- 1. /student/today GET shape ------------------------------------------


class TestStudentTodayGet:
    def test_no_query_defaults_to_today(self, api, admin_pair):
        r = api.get(f"{API}/student/today", headers=_auth(admin_pair["student_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["date"] == _today_iso()
        assert body["day"] == _weekday_for(_today_iso())
        assert body["for"] == "today"
        assert "menu" in body
        assert "plan" in body

    def test_for_today_explicit(self, api, admin_pair):
        r = api.get(f"{API}/student/today?for=today", headers=_auth(admin_pair["student_token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["date"] == _today_iso()
        assert body["for"] == "today"

    def test_for_tomorrow(self, api, admin_pair):
        r = api.get(f"{API}/student/today?for=tomorrow", headers=_auth(admin_pair["student_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["date"] == _tomorrow_iso()
        assert body["day"] == _weekday_for(_tomorrow_iso())
        assert body["for"] == "tomorrow"
        # No plan yet for tomorrow
        assert body["plan"] is None

    def test_for_invalid_returns_422(self, api, admin_pair):
        r = api.get(f"{API}/student/today?for=yesterday", headers=_auth(admin_pair["student_token"]))
        assert r.status_code == 422, r.text


# --- 2. PUT /student/today writes to selected date -------------------------


class TestStudentTodayUpsert:
    def test_put_for_tomorrow_persists(self, api, admin_pair):
        tomorrow = _tomorrow_iso()
        payload = {
            "date": tomorrow,
            "breakfast": {"status": "ON", "selected_items": ["Idli", "Sambar"]},
            "lunch": {"status": "ON", "selected_items": ["Rice"]},
            "dinner": {"status": "OFF", "selected_items": [], "reason_if_off": "out"},
        }
        r = api.put(f"{API}/student/today", headers=_auth(admin_pair["student_token"]), json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["plan"]["date"] == tomorrow
        assert body["plan"]["breakfast"]["status"] == "ON"
        assert body["plan"]["dinner"]["status"] == "OFF"

        # GET ?for=tomorrow returns the saved plan
        g = api.get(f"{API}/student/today?for=tomorrow", headers=_auth(admin_pair["student_token"]))
        assert g.status_code == 200
        gp = g.json()["plan"]
        assert gp is not None
        assert gp["date"] == tomorrow
        assert gp["breakfast"]["selected_items"] == ["Idli", "Sambar"]
        assert gp["dinner"]["reason_if_off"] == "out"

        # GET ?for=today should NOT return that plan (different date)
        gt = api.get(f"{API}/student/today?for=today", headers=_auth(admin_pair["student_token"]))
        assert gt.status_code == 200
        plan_today = gt.json()["plan"]
        assert plan_today is None or plan_today.get("date") != tomorrow

    def test_put_default_date_is_today(self, api, admin_pair):
        payload = {
            "breakfast": {"status": "ON", "selected_items": ["Toast"]},
            "lunch": {"status": "ON", "selected_items": []},
            "dinner": {"status": "ON", "selected_items": []},
        }
        r = api.put(f"{API}/student/today", headers=_auth(admin_pair["student_token"]), json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["plan"]["date"] == _today_iso()

    def test_put_invalid_date_400(self, api, admin_pair):
        payload = {
            "date": "not-a-date",
            "breakfast": {"status": "ON"},
            "lunch": {"status": "ON"},
            "dinner": {"status": "ON"},
        }
        r = api.put(f"{API}/student/today", headers=_auth(admin_pair["student_token"]), json=payload)
        assert r.status_code == 400, r.text


# --- 3. /admin/dashboard with for= ----------------------------------------


class TestAdminDashboard:
    def test_no_query_today(self, api, admin_pair):
        r = api.get(f"{API}/admin/dashboard", headers=_auth(admin_pair["admin_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["date"] == _today_iso()
        assert body["day"] == _weekday_for(_today_iso())
        assert body["for"] == "today"
        assert "meals" in body and "summary" in body
        for meal in ("breakfast", "lunch", "dinner"):
            assert meal in body["meals"]

    def test_for_tomorrow_returns_tomorrow_date(self, api, admin_pair):
        r = api.get(f"{API}/admin/dashboard?for=tomorrow", headers=_auth(admin_pair["admin_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["date"] == _tomorrow_iso()
        assert body["day"] == _weekday_for(_tomorrow_iso())
        assert body["for"] == "tomorrow"

    def test_invalid_for_422(self, api, admin_pair):
        r = api.get(f"{API}/admin/dashboard?for=next-week", headers=_auth(admin_pair["admin_token"]))
        assert r.status_code == 422

    def test_summary_counts_only_target_day(self, api, admin_pair):
        """Submit a plan ONLY for tomorrow; today total_responses should remain 0
        and tomorrow total_responses should be >=1.
        """
        tomorrow = _tomorrow_iso()
        payload = {
            "date": tomorrow,
            "breakfast": {"status": "ON", "selected_items": ["Idli"]},
            "lunch": {"status": "ON", "selected_items": []},
            "dinner": {"status": "ON", "selected_items": []},
        }
        # Ensure no leftover plans for either date for this student
        _db.daily_plans.delete_many({"hostel": admin_pair["hostel"]})

        r = api.put(f"{API}/student/today", headers=_auth(admin_pair["student_token"]), json=payload)
        assert r.status_code == 200, r.text

        today_dash = api.get(f"{API}/admin/dashboard", headers=_auth(admin_pair["admin_token"]))
        tom_dash = api.get(f"{API}/admin/dashboard?for=tomorrow", headers=_auth(admin_pair["admin_token"]))
        assert today_dash.status_code == 200
        assert tom_dash.status_code == 200

        today_summary = today_dash.json()["summary"]
        tom_summary = tom_dash.json()["summary"]

        assert today_summary["total_responses"] == 0, today_summary
        assert tom_summary["total_responses"] == 1, tom_summary
        # Eating counts: tomorrow has breakfast/lunch/dinner all ON
        assert tom_summary["breakfast_eating"] == 1
        assert tom_summary["lunch_eating"] == 1
        assert tom_summary["dinner_eating"] == 1
        # Today's eating counts should all be 0
        assert today_summary["breakfast_eating"] == 0
        assert today_summary["lunch_eating"] == 0
        assert today_summary["dinner_eating"] == 0


# --- 4. Regression on other endpoints --------------------------------------


class TestRegression:
    def test_login_existing_user(self, api, admin_pair):
        r = api.post(f"{API}/auth/login", json={
            "email": admin_pair["student_email"], "password": "secret123",
        })
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()

    def test_register_new_user(self, api, created_emails):
        email = _unique_email("regnew")
        created_emails["emails"].add(email)
        r = api.post(f"{API}/auth/register", json={
            "full_name": "New",
            "email": email,
            "password": "secret123",
            "institution_or_hostel_name": "TEST_It9_RegHostel",
        })
        assert r.status_code == 201, r.text

    def test_admin_students(self, api, admin_pair):
        r = api.get(f"{API}/admin/students", headers=_auth(admin_pair["admin_token"]))
        assert r.status_code == 200
        assert "students" in r.json() or isinstance(r.json(), (list, dict))

    def test_admin_notifications(self, api, admin_pair):
        r = api.get(f"{API}/admin/notifications", headers=_auth(admin_pair["admin_token"]))
        assert r.status_code == 200

    def test_admin_dispatch_reminder(self, api, admin_pair):
        r = api.post(
            f"{API}/admin/notifications/dispatch-reminder",
            headers=_auth(admin_pair["admin_token"]),
            json={"audience": "student"},
        )
        assert r.status_code == 201

    def test_admin_wastage_today(self, api, admin_pair):
        r = api.get(f"{API}/admin/wastage/today", headers=_auth(admin_pair["admin_token"]))
        assert r.status_code == 200

    def test_admin_necessary_info(self, api, admin_pair):
        r = api.get(f"{API}/admin/necessary-info", headers=_auth(admin_pair["admin_token"]))
        assert r.status_code == 200
