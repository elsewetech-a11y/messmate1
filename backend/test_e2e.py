import asyncio
import httpx
import time
import datetime
import os
import uuid

API_URL = "http://127.0.0.1:8000/api"
UNIQUE = int(time.time())

async def main():
    TEST_PASSWORD = os.getenv("TEST_PASSWORD", f"Pass_{uuid.uuid4().hex[:8]}!")
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Register admin
        print("Registering Admin...")
        admin_data = {
            "full_name": "Test Admin",
            "email": f"admin_{UNIQUE}@example.com",
            "password": TEST_PASSWORD,
            "institution_or_hostel_name": "Test Hostel",
            "role": "admin"
        }
        res = await client.post(f"{API_URL}/auth/register", json=admin_data)
        print("Admin Register:", res.status_code, res.text)
        
        # Bypass email verification directly in MongoDB
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo = AsyncIOMotorClient('mongodb://localhost:27017')
        db = mongo["messmate"]
        await db.users.update_many({}, {"$set": {"email_verified": True, "approval_status": "approved"}})
        
        # Login Admin
        res = await client.post(f"{API_URL}/auth/login", json={"email": f"admin_{UNIQUE}@example.com", "password": TEST_PASSWORD})
        if "access_token" not in res.json():
            print("Admin Login Failed:", res.status_code, res.text)
            return
        admin_token = res.json()["access_token"]
        
        # 2. Register Students
        print("Registering Students...")
        student1_data = {
            "full_name": "Student One",
            "email": f"student1_{UNIQUE}@example.com",
            "password": TEST_PASSWORD,
            "institution_or_hostel_name": "Test Hostel",
            "role": "student"
        }
        res = await client.post(f"{API_URL}/auth/register", json=student1_data)
        print("Student1 Register:", res.status_code, res.text)
        
        student2_data = {
            "full_name": "Student Two",
            "email": f"student2_{UNIQUE}@example.com",
            "password": TEST_PASSWORD,
            "institution_or_hostel_name": "Test Hostel",
            "role": "student"
        }
        res = await client.post(f"{API_URL}/auth/register", json=student2_data)
        print("Student2 Register:", res.status_code, res.text)
        
        # Update again for students
        await db.pending_requests.update_many({"email": {"$in": [f"student1_{UNIQUE}@example.com", f"student2_{UNIQUE}@example.com"]}}, {"$set": {"email_verified": True}})
        
        # 3. Approve Students
        print("Approving Students...")
        res = await client.get(f"{API_URL}/admin/students", headers={"Authorization": f"Bearer {admin_token}"})
        students = res.json()
        for s in students:
            if s["approval_status"] != "approved" and s["email"].endswith(f"{UNIQUE}@example.com"):
                res = await client.post(f"{API_URL}/admin/students/{s['id']}/approve", headers={"Authorization": f"Bearer {admin_token}"})
                print(f"Approved {s['full_name']}:", res.status_code)
        
        # Login Student 1
        res = await client.post(f"{API_URL}/auth/login", json={"email": f"student1_{UNIQUE}@example.com", "password": TEST_PASSWORD})
        if "access_token" not in res.json():
            print("Student 1 Login Failed:", res.status_code, res.text)
            return
        student1_token = res.json()["access_token"]
        
        # Login Student 2
        res = await client.post(f"{API_URL}/auth/login", json={"email": f"student2_{UNIQUE}@example.com", "password": TEST_PASSWORD})
        if "access_token" not in res.json():
            print("Student 2 Login Failed:", res.status_code, res.text)
            return
        student2_token = res.json()["access_token"]
        
        # 4. Schedule Notification
        print("Scheduling Notification...")
        now = datetime.datetime.now()
        schedule_time = f"{now.hour:02d}:{now.minute:02d}"
        today = now.strftime("%Y-%m-%d")
        
        notif_data = {
            "title": "Test Daily Notification",
            "message": "This is a test message.",
            "notificationType": "Daily",
            "scheduledTime": schedule_time,
            "startDate": today
        }
        res = await client.post(f"{API_URL}/admin/scheduled-notifications", json=notif_data, headers={"Authorization": f"Bearer {admin_token}"})
        print("Schedule Notification:", res.status_code, res.text)
        
        # Wait for scheduler loop to run (interval is 30s usually, wait 35s)
        print("Waiting 35s for scheduler loop...")
        await asyncio.sleep(35)
        
        # 5. Check if students received it
        print("Checking Student 1 Notifications...")
        res = await client.get(f"{API_URL}/student/notifications", headers={"Authorization": f"Bearer {student1_token}"})
        print("Student 1 Notifs:", res.status_code, res.text)
        
        print("Checking Student 2 Notifications...")
        res = await client.get(f"{API_URL}/student/notifications", headers={"Authorization": f"Bearer {student2_token}"})
        print("Student 2 Notifs:", res.status_code, res.text)
        
        print("TEST COMPLETED.")

asyncio.run(main())
