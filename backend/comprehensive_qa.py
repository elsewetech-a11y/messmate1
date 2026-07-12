import httpx
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime, timedelta

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client["messmate"]
BASE_URL = "http://127.0.0.1:8000/api"

class QAError(Exception):
    pass

async def assert_status(response, expected_status: int, step_name: str):
    if response.status_code != expected_status:
        raise QAError(f"[{step_name}] Failed! Expected {expected_status}, got {response.status_code}: {response.text}")
    print(f"[{step_name}] Success ({expected_status})")

from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def get_otp(email, purpose):
    # Overwrite the hashed OTP in the DB with a known hash for '123456'
    known_otp = "123456"
    known_hash = pwd_context.hash(known_otp)
    await db["email_otps"].update_one(
        {"email": email, "purpose": purpose},
        {"$set": {"otp_hash": known_hash}}
    )
    return known_otp

async def run_qa():
    TEST_PASSWORD = os.getenv("TEST_PASSWORD", f"Pass_{uuid.uuid4().hex[:8]}!")
    inst = f"QA Univ {uuid.uuid4().hex[:6]}"
    admin_email = f"admin_{uuid.uuid4().hex[:6]}@messmate.app"
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as api:
        print("=== 1. Fresh Application Testing (Admin) ===")
        r = await api.post("/auth/register", json={
            "full_name": "QA Admin",
            "email": admin_email,
            "password": TEST_PASSWORD,
            "role": "admin",
            "institution_or_hostel_name": inst
        })
        await assert_status(r, 201, "Admin Registration")
        
        otp = await get_otp(admin_email, "registration")
        r = await api.post("/auth/verify-email", json={
            "email": admin_email,
            "otp": otp,
            "purpose": "registration"
        })
        await assert_status(r, 200, "Admin OTP Verify")
        
        r = await api.post("/auth/login", json={"email": admin_email, "password": TEST_PASSWORD})
        await assert_status(r, 200, "Admin Login")
        admin_token = r.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        print("\n=== 2. Create 5 Student Accounts ===")
        students = []
        for i in range(1, 6):
            email = f"student{i}_{uuid.uuid4().hex[:4]}@messmate.app"
            r = await api.post("/auth/register", json={
                "full_name": f"QA Student {i}",
                "email": email,
                "password": TEST_PASSWORD,
                "role": "student",
                "institution_or_hostel_name": inst,
                "room_number": f"{100+i}"
            })
            await assert_status(r, 201, f"Student {i} Register")
            otp = await get_otp(email, "registration")
            r = await api.post("/auth/verify-email", json={"email": email, "otp": otp, "purpose": "registration"})
            await assert_status(r, 200, f"Student {i} Verify")
            students.append({"email": email, "password": TEST_PASSWORD})
            
        print("\n=== 3. Student Approval Process ===")
        r = await api.get("/admin/students", headers=admin_headers)
        await assert_status(r, 200, "Get Students")
        db_students = r.json().get("students", [])
        for s in db_students:
            r = await api.post(f"/admin/students/{s['id']}/approve", headers=admin_headers)
            await assert_status(r, 200, f"Approve {s['full_name']}")
            
        student_tokens = []
        for s in students:
            r = await api.post("/auth/login", json=s)
            await assert_status(r, 200, f"Login {s['email']}")
            student_tokens.append(r.json()["access_token"])
            
        print("\n=== 4. Food Management ===")
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for day in days:
            menu_data = {
                "day": day,
                "breakfast_items": ["Idli", "Sambar"],
                "lunch_items": ["Rice", "Dal", "Curry"],
                "dinner_items": ["Roti", "Paneer"],
                "breakfast_custom_question": {"enabled": False, "text": "", "options": []},
                "lunch_custom_question": {"enabled": False, "text": "", "options": []},
                "dinner_custom_question": {"enabled": False, "text": "", "options": []}
            }
            r = await api.put(f"/admin/menus/{day}", json=menu_data, headers=admin_headers)
            await assert_status(r, 200, f"Set Menu {day}")
            
        print("\n=== 5. Student Selection ===")
        tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        for idx, token in enumerate(student_tokens):
            status = "ON" if idx < 3 else "OFF"
            r = await api.put("/student/today", json={
                "date": tomorrow_str,
                "breakfast": {"status": status},
                "lunch": {"status": status},
                "dinner": {"status": status}
            }, headers={"Authorization": f"Bearer {token}"})
            await assert_status(r, 200, f"Student {idx+1} Pref: {status}")
            
        print("\n=== 6. Verify Dashboards ===")
        r = await api.get("/admin/dashboard?for=today", headers=admin_headers)
        await assert_status(r, 200, "Dashboard Today")
        
        r = await api.get("/admin/dashboard?for=tomorrow", headers=admin_headers)
        await assert_status(r, 200, "Dashboard Tomorrow")

        print("\n=== 7. Subscription Checkout ===")
        r = await api.post("/subscription/order", json={
            "plan_type": "monthly",
            "student_count": 50
        }, headers=admin_headers)
        await assert_status(r, 200, "Create Sub Order")
        order = r.json()
        
        r = await api.post("/subscription/verify-payment", json={
            "order_id": order["order_id"],
            "payment_id": "TEST_PAY_123",
            "signature": "mock_signature"
        }, headers=admin_headers)
        await assert_status(r, 200, "Verify Payment")

        print("\nALL PASSED!")

if __name__ == "__main__":
    asyncio.run(run_qa())
