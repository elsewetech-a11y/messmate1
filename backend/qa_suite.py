import httpx
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime, timedelta, timezone

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client["messmate_dev"]
BASE_URL = "http://127.0.0.1:8000/api"

async def clear_db(institution_name: str):
    # clear existing test data for this institution
    await db["users"].delete_many({"institution_or_hostel_name": institution_name})
    await db["subscriptions"].delete_many({"institution_or_hostel_name": institution_name})
    await db["menus"].delete_many({"institution_or_hostel_name": institution_name})
    await db["daily_plans"].delete_many({"institution_or_hostel_name": institution_name})
    await db["menu_reactions"].delete_many({"institution_or_hostel_name": institution_name})
    await db["notifications"].delete_many({"institution_or_hostel_name": institution_name})
    await db["transactions"].delete_many({"institution_or_hostel_name": institution_name})
    await db["subscription_events"].delete_many({"institution_or_hostel_name": institution_name})
    await db["invoices"].delete_many({"institution_or_hostel_name": institution_name})

async def get_otp(email, purpose):
    doc = await db["email_otps"].find_one({"email": email, "purpose": purpose})
    return doc["otp"] if doc else None

class QAError(Exception):
    pass

async def assert_status(response, expected_status: int, step_name: str):
    if response.status_code != expected_status:
        raise QAError(f"[{step_name}] Failed! Expected {expected_status}, got {response.status_code}: {response.text}")
    print(f"[{step_name}] Success ({expected_status})")

async def main():
    TEST_PASSWORD = os.getenv("TEST_PASSWORD", f"Pass_{uuid.uuid4().hex[:8]}!")
    inst = f"QA University {uuid.uuid4().hex[:6]}"
    admin_email = f"admin_{uuid.uuid4().hex[:6]}@messmate.app"
    
    await clear_db(inst)
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as api:
        print("=== 1. Fresh Application Testing (Admin) ===")
        r = await api.post("/auth/register", json={
            "full_name": "QA Admin",
            "email": admin_email,
            "password": TEST_PASSWORD,
            "role": "admin",
            "institution_or_hostel_name": inst
        })
        await assert_status(r, 200, "Admin Registration")
        
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
        
        print("\n=== 1b. Student Registration ===")
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
            await assert_status(r, 200, f"Student {i} Register")
            otp = await get_otp(email, "registration")
            r = await api.post("/auth/verify-email", json={"email": email, "otp": otp, "purpose": "registration"})
            await assert_status(r, 200, f"Student {i} Verify")
            students.append({"email": email, "password": TEST_PASSWORD})
            
        print("\n=== 2. Student Approval Process ===")
        # Check unapproved login
        r = await api.post("/auth/login", json=students[0])
        await assert_status(r, 200, "Student 1 Initial Login")
        # Ensure student is pending
        user_data = r.json()["user"]
        if user_data["approval_status"] != "pending":
            raise QAError("Student should be pending")
            
        # Admin gets students
        r = await api.get("/admin/students", headers=admin_headers)
        await assert_status(r, 200, "Get Students")
        db_students = r.json()
        if len(db_students) != 5:
            raise QAError(f"Expected 5 students, got {len(db_students)}")
            
        # Admin approves
        for s in db_students:
            r = await api.put(f"/admin/students/{s['id']}/status", json={"status": "approved"}, headers=admin_headers)
            await assert_status(r, 200, f"Approve {s['full_name']}")
            
        # Approved Login
        student_tokens = []
        for s in students:
            r = await api.post("/auth/login", json=s)
            await assert_status(r, 200, f"Login {s['email']}")
            if r.json()["user"]["approval_status"] != "approved":
                raise QAError("Student should be approved now")
            student_tokens.append(r.json()["access_token"])
            
        print("\n=== 3. Food Management Module ===")
        # Create menus for the week
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for day in days:
            menu_data = {
                "day": day,
                "breakfast_items": ["Idli", "Sambar"],
                "lunch_items": ["Rice", "Dal", "Curry"],
                "dinner_items": ["Roti", "Paneer"],
                "breakfast_custom_question": {"enabled": False, "question": ""},
                "lunch_custom_question": {"enabled": False, "question": ""},
                "dinner_custom_question": {"enabled": False, "question": ""}
            }
            r = await api.put(f"/admin/menu/weekly/{day}", json=menu_data, headers=admin_headers)
            await assert_status(r, 200, f"Set Menu {day}")
            
        print("\n=== 4. Student Food Selection ===")
        tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # 3 students choose YES, 2 choose NO
        for idx, token in enumerate(student_tokens):
            status = "ON" if idx < 3 else "OFF"
            r = await api.put("/student/plan", json={
                "date": tomorrow_str,
                "breakfast": {"status": status},
                "lunch": {"status": status},
                "dinner": {"status": status}
            }, headers={"Authorization": f"Bearer {token}"})
            await assert_status(r, 200, f"Student {idx+1} Pref: {status}")
            
        print("\n=== 5. Tomorrow's Attendance Calculation ===")
        r = await api.get("/admin/dashboard/today", headers=admin_headers)
        await assert_status(r, 200, "Get Dashboard (Today)")
        
        # For testing attendance logic, let's query the specific API that gives tomorrow's attendance
        # Note: If dashboard is only for today, we might need a specific endpoint. 
        # Actually /admin/dashboard/today checks today, maybe /admin/responses?date=tomorrow
        r = await api.get(f"/admin/responses?date={tomorrow_str}", headers=admin_headers)
        if r.status_code == 200:
            print("Get Responses Success")
            data = r.json()
            # Verify counts here if endpoint supports it
            
        print("\n=== 8. Free Trial Verification ===")
        # Get sub status
        r = await api.get("/subscription/status", headers=admin_headers)
        await assert_status(r, 200, "Check Trial Status")
        print(f"Trial status: {r.json()}")
        
        print("\n=== 9. Subscription Testing ===")
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
        
        r = await api.get("/subscription/status", headers=admin_headers)
        sub = r.json()
        if sub["status"] != "ACTIVE" or sub["is_trial"] == True:
            raise QAError("Subscription should be active and not trial")
        print("Subscription Payment successful and Active.")
        
        print("\n=== QA Script End ===")

if __name__ == "__main__":
    asyncio.run(main())
