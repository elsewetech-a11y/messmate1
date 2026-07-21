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
    for inst in institutions:
        sub = await db.subscriptions.find_one({"institution_or_hostel_name": inst})
        if not sub:
            print(f"Creating default ACTIVE subscription for {inst}")
            await db.subscriptions.insert_one({
                "institution_or_hostel_name": inst,
                "status": "ACTIVE",
                "is_trial": False,
                "trial_start_date": None,
                "trial_end_date": None,
                "subscription_start_date": "2026-07-20T00:00:00+00:00",
                "subscription_end_date": "2027-07-20T00:00:00+00:00",
                "grace_period_end_date": None,
                "plan_type": "yearly",
                "student_limit": 500,
                "auto_renew": True,
                "payment_status": "PAID"
            })
        else:
            await db.subscriptions.update_one({"institution_or_hostel_name": inst}, {"$set": {"status": "ACTIVE", "subscription_end_date": "2027-07-20T00:00:00+00:00"}})
            
    print("Subscriptions synced!")

asyncio.run(main())
