import asyncio
import os
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv

# Load env
load_dotenv()
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "messmate_dev")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
users_col = db["users"]
subscriptions_col = db["subscriptions"]
settings_col = db["app_settings"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed():
    print("Seeding database...")
    
    super_admin_email = "admin@messmate.app"
    super_admin_pass = os.getenv("SEED_SUPER_ADMIN_PASSWORD", "SuperSecret123!")
    
    # 1. Create Super Admin
    existing = await users_col.find_one({"email": super_admin_email})
    if not existing:
        admin_id = str(uuid.uuid4())
        await users_col.insert_one({
            "id": admin_id,
            "full_name": "MessMate Super Admin",
            "email": super_admin_email,
            "mobile_or_user_id": "0000000000",
            "password_hash": pwd_context.hash(super_admin_pass),
            "role": "SUPER_ADMIN",
            "approval_status": "approved",
            "email_verified": True,
            "institution_or_hostel_name": "GLOBAL",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
        print(f"Created Super Admin: {super_admin_email}")
    else:
        print("Super Admin already exists.")
        
    # 2. Create a default Demo Institution for demonstration purposes
    demo_inst = "Demo University"
    existing_inst = await subscriptions_col.find_one({"institution_or_hostel_name": demo_inst})
    if not existing_inst:
        await subscriptions_col.insert_one({
            "institution_or_hostel_name": demo_inst,
            "status": "ACTIVE",
            "plan_type": "yearly",
            "is_trial": False,
            "student_limit": 500,
            "auto_renew": True,
            "communication_preferences": {
                "email_notifications": True,
                "push_notifications": True,
                "capacity_alerts": True,
                "renewal_reminders": True,
                "payment_confirmations": True,
                "invoice_emails": True
            }
        })
        
        await settings_col.insert_one({
            "hostel": demo_inst,
            "default_meal_state": "ON",
            "default_like_dislike_state": "no_response",
            "default_preference_state": "none",
            "notifications_enabled": True,
            "language": "English",
            "pricing": {
                "currency": "INR",
                "monthly_base_price": 5000,
                "monthly_student_price": 2,
                "yearly_base_price": 50000,
                "yearly_student_price": 18
            }
        })
        print(f"Created Demo Institution: {demo_inst}")
        
    print("Seeding complete.")

if __name__ == "__main__":
    asyncio.run(seed())
