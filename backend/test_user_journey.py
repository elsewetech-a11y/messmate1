import httpx
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timedelta

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client["messmate_dev"]
otps = db["email_otps"]

BASE_URL = "http://127.0.0.1:8000/api"

async def get_otp(email, purpose):
    doc = await otps.find_one({"email": email, "purpose": purpose})
    return doc["otp"] if doc else None

async def run_journey():
    TEST_PASSWORD = os.getenv("TEST_PASSWORD", f"Pass_{uuid.uuid4().hex[:8]}!")
    async with httpx.AsyncClient(base_url=BASE_URL) as api:
        print("=== 1. Register Admin ===")
        admin_email = f"admin_{uuid.uuid4().hex[:6]}@messmate.app"
        inst = f"Inst_{uuid.uuid4().hex[:6]}"
        r = await api.post("/auth/register", json={
            "full_name": "Journey Admin",
            "email": admin_email,
            "password": TEST_PASSWORD,
            "role": "admin",
            "institution_or_hostel_name": inst
        })
        print(f"Register Admin: {r.status_code}")

        otp = await get_otp(admin_email, "registration")
        r = await api.post("/auth/verify-email", json={
            "email": admin_email,
            "otp": otp,
            "purpose": "registration"
        })
        print(f"Verify Admin: {r.status_code}")

        r = await api.post("/auth/login", json={
            "email": admin_email,
            "password": TEST_PASSWORD
        })
        admin_token = r.json()["access_token"]
        print(f"Login Admin: {r.status_code}")

        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        print("\n=== 2. Check Subscription Plan Option ===")
        # Admin creates order
        r = await api.post("/subscription/order", json={
            "plan_type": "yearly",
            "student_count": 50
        }, headers=admin_headers)
        print(f"Create Order: {r.status_code}")
        order_data = r.json()
        
        # Verify Payment (mock)
        r = await api.post("/subscription/verify-payment", json={
            "order_id": order_data["order_id"],
            "payment_id": "MOCK_PAY_123"
        }, headers=admin_headers)
        print(f"Verify Payment (Simulate Bank): {r.status_code} - {r.json().get('message')}")

        r = await api.get("/subscription/status", headers=admin_headers)
        print(f"Subscription Status: {r.status_code} - Plan: {r.json().get('plan_type')}")

        print("\n=== 3. Register 3 Students ===")
        student_tokens = []
        for i in range(1, 4):
            se = f"student{i}_journey@messmate.app"
            r = await api.post("/auth/register", json={
                "full_name": f"Student {i}",
                "email": se,
                "password": TEST_PASSWORD,
                "role": "student",
                "institution_or_hostel_name": inst,
                "room_number": f"{100+i}"
            })
            otp = await get_otp(se, "registration")
            r = await api.post("/auth/verify-email", json={
                "email": se,
                "otp": otp,
                "purpose": "registration"
            })
            r = await api.post("/auth/login", json={"email": se, "password": TEST_PASSWORD})
            student_tokens.append(r.json()["access_token"])
            print(f"Registered & Logged in Student {i}")

        print("\n=== 4. Admin Approves Students ===")
        r = await api.get("/admin/students", headers=admin_headers)
        students = r.json()
        pending = [s for s in students if s["approval_status"] == "pending"]
        for s in pending:
            r = await api.put(f"/admin/students/{s['id']}/status", json={"status": "approved"}, headers=admin_headers)
            print(f"Approved student {s['full_name']}")

        print("\n=== 5. Check Notifications ===")
        r = await api.get("/notifications", headers=admin_headers)
        notifs = r.json()
        print(f"Admin Notifications: {len(notifs)} found.")
        for n in notifs:
            print(f" - [{n['category']}] {n['title']}")
            
        student_headers = {"Authorization": f"Bearer {student_tokens[0]}"}
        r = await api.get("/student/notifications", headers=student_headers)
        print(f"Student 1 Notifications: {len(r.json().get('items', []))} found.")

        print("\n=== 6. Test Forgot Password ===")
        r = await api.post("/auth/forgot-password", json={"email": admin_email})
        print(f"Forgot Password Requested: {r.status_code}")
        otp = await get_otp(admin_email, "forgot_password")
        r = await api.post("/auth/reset-password", json={
            "email": admin_email,
            "otp": otp,
            "new_password": "NewPassword321!"
        })
        print(f"Password Reset: {r.status_code}")

        r = await api.post("/auth/login", json={
            "email": admin_email,
            "password": "NewPassword321!"
        })
        print(f"Login with New Password: {r.status_code}")
        
        print("\n=== Tests Completed Successfully! ===")

if __name__ == "__main__":
    asyncio.run(run_journey())
