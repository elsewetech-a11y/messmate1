import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
IST = timezone(timedelta(hours=5, minutes=30))

def now_iso() -> str:
    return datetime.now(IST).isoformat()

async def seed():
    client = AsyncIOMotorClient("mongodb://127.0.0.1:27017")
    db = client["messmate"]
    
    email = "elsewe.tech@gmail.com"
    hostel = "Elsewe Tech"
    
    password_hash = pwd_context.hash("Messmate@123")
    
    user_id = str(uuid.uuid4())
    admin_doc = {
        "id": user_id,
        "full_name": "Elsewe Tech Admin",
        "email": email,
        "mobile_or_user_id": email,
        "institution_or_hostel_name": hostel,
        "password_hash": password_hash,
        "role": "admin",
        "approval_status": "approved",
        "email_verified": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    
    # 1. Insert into users collection
    await db["users"].update_one(
        {"email": email},
        {"$set": admin_doc},
        upsert=True
    )
    print(f"Upserted admin doc for {email} in users collection.")
    
    # 2. Insert into _central_admin_registry
    admin_reg_doc = {
        "admin_id": user_id,
        "email": email,
        "institution_or_hostel_name": hostel,
        "database_key": "db1",
        "database_name": "messmate",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db["_central_admin_registry"].update_one(
        {"email": email},
        {"$set": admin_reg_doc},
        upsert=True
    )
    print(f"Upserted central admin registry for {email}.")
    
    # 3. Insert into _central_auth_registry
    auth_reg_doc = {
        "email": email,
        "role": "admin",
        "institution_or_hostel_name": hostel,
        "database_key": "db1",
        "database_name": "messmate",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db["_central_auth_registry"].update_one(
        {"email": email},
        {"$set": auth_reg_doc},
        upsert=True
    )
    print(f"Upserted central auth registry for {email}.")
    
    # 4. Insert active trial subscription for this hostel
    trial_start = datetime.now(IST)
    trial_end = trial_start + timedelta(days=365)
    sub_doc = {
        "institution_or_hostel_name": hostel,
        "admin_id": user_id,
        "admin_email": email,
        "status": "TRIAL_ACTIVE",
        "is_trial": True,
        "trial_start_date": trial_start.isoformat(),
        "trial_end_date": trial_end.isoformat(),
        "plan_type": "trial",
        "student_limit": 999999,
        "auto_renew": False,
        "payment_status": "NONE",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db["subscriptions"].update_one(
        {"institution_or_hostel_name": hostel},
        {"$set": sub_doc},
        upsert=True
    )
    print(f"Upserted subscription for {hostel}.")
    
    # 5. Also seed Marutham admin with same credentials if needed
    marutham_sub = await db["subscriptions"].find_one({"institution_or_hostel_name": "Marutham"})
    if not marutham_sub:
        await db["subscriptions"].insert_one({
            "institution_or_hostel_name": "Marutham",
            "admin_id": user_id,
            "admin_email": email,
            "status": "TRIAL_ACTIVE",
            "is_trial": True,
            "trial_start_date": trial_start.isoformat(),
            "trial_end_date": trial_end.isoformat(),
            "plan_type": "trial",
            "student_limit": 999999,
            "auto_renew": False,
            "payment_status": "NONE",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        print("Upserted subscription for Marutham.")
    
    print("\n[SUCCESS] elsewe.tech admin data seeded and verified!")

if __name__ == "__main__":
    asyncio.run(seed())
