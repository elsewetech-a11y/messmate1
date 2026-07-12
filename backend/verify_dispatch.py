import asyncio
import os
import sys

# Load env before importing server
os.environ["SMTP_HOST"] = ""
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASS"] = ""
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient

# Setup path so we can import server
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import server

async def main():
    IST = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(IST)
    today_str = now.strftime("%Y-%m-%d")
    current_time_str = f"{now.hour:02d}:{now.minute:02d}"

    print(f"Current Time: {today_str} {current_time_str}")

    # 1. Clean up old test data
    print("Cleaning up old test data...")
    await server.users_col.delete_many({"institution_or_hostel_name": "Test Hostel"})
    await server.scheduled_notifications_col.delete_many({"hostel": "Test Hostel"})
    await server.notifications_col.delete_many({"hostel": "Test Hostel"})
    
    # 2. Insert Admin
    admin_id = "test_admin_1"
    await server.users_col.insert_one({
        "id": admin_id,
        "full_name": "Test Admin",
        "email": "admin@example.com",
        "mobile_or_user_id": "admin@example.com",
        "institution_or_hostel_name": "Test Hostel",
        "role": "admin",
        "approval_status": "approved",
        "email_verified": True
    })

    # 3. Insert Students
    student1_id = "test_student_1"
    student2_id = "test_student_2"
    await server.users_col.insert_many([
        {
            "id": student1_id,
            "full_name": "Test Student 1",
            "email": "student1@example.com",
            "mobile_or_user_id": "student1@example.com",
            "institution_or_hostel_name": "Test Hostel",
            "role": "student",
            "approval_status": "approved",
            "email_verified": True
        },
        {
            "id": student2_id,
            "full_name": "Test Student 2",
            "email": "student2@example.com",
            "mobile_or_user_id": "student2@example.com",
            "institution_or_hostel_name": "Test Hostel",
            "role": "student",
            "approval_status": "approved",
            "email_verified": True
        }
    ])
    
    # 4. Insert Scheduled Notification (Daily) matching current time
    notif_id = "test_notif_1"
    await server.scheduled_notifications_col.insert_one({
        "id": notif_id,
        "adminId": admin_id,
        "hostel": "Test Hostel",
        "title": "Daily Notification Test",
        "message": "Did you receive this?",
        "notificationType": "Daily",
        "startDate": today_str,
        "endDate": None,
        "scheduledTime": current_time_str,
        "isActive": True,
        "createdAt": now.isoformat(),
        "stats": {"totalRecipients": 0, "delivered": 0}
    })
    print("Inserted Scheduled Notification.")

    # 5. Call Dispatcher
    print("Running dispatcher...")
    dispatched = await server._dispatch_recurring_notifications()
    print(f"Dispatched count: {dispatched}")

    # 6. Verify Students Received It
    student_notifs = await server.notifications_col.find({"hostel": "Test Hostel"}).to_list(None)
    print(f"Total Student Notifications in History: {len(student_notifs)}")
    for n in student_notifs:
        print(" ->", n["title"], "|", n["action_url"])

    # 7. Check that the scheduled notification was updated (lastSentAt)
    doc = await server.scheduled_notifications_col.find_one({"id": notif_id})
    print(f"Last Sent At: {doc.get('lastSentAt')}")
    print(f"Stats: {doc.get('stats')}")

asyncio.run(main())
