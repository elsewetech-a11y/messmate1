import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(r'c:\Users\kames\mess mate\messmate1\backend\.env')
client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
db = client[os.getenv('DB_NAME')]

async def main():
    institutions = await db.users.distinct('institution_or_hostel_name')
    print("User institutions:", institutions)
    
    # Sync all subscriptions for all institutions
    from datetime import datetime, timedelta, timezone
    now_dt = datetime.now(timezone.utc)
    for inst in institutions:
        admin_user = await db.users.find_one({"institution_or_hostel_name": inst, "role": "admin"})
        created_dt = datetime.fromisoformat(admin_user["created_at"]) if admin_user and admin_user.get("created_at") else now_dt
        trial_end = created_dt + timedelta(days=10)
        is_expired = now_dt >= trial_end

        sub = await db.subscriptions.find_one({"institution_or_hostel_name": inst})
        if not sub or sub.get("payment_status") not in ["SUCCESS", "PAID"]:
            trial_doc = {
                "institution_or_hostel_name": inst,
                "status": "TRIAL_EXPIRED" if is_expired else "TRIAL_ACTIVE",
                "is_trial": True,
                "trial_start_date": created_dt.isoformat(),
                "trial_end_date": trial_end.isoformat(),
                "subscription_start_date": None,
                "subscription_end_date": None,
                "grace_period_end_date": None,
                "plan_type": "trial",
                "student_limit": 999999,
                "auto_renew": False,
                "payment_status": "NONE"
            }
            await db.subscriptions.update_one(
                {"institution_or_hostel_name": inst},
                {"$set": trial_doc, "$unset": {"days_remaining": ""}},
                upsert=True
            )
            
    print("Subscriptions synced!")

asyncio.run(main())
