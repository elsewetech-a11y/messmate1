import asyncio
import os
from datetime import date, timedelta, datetime, timezone
import random
import uuid

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv

# Load env
load_dotenv()
MONGO_URL = os.environ.get("MONGO_URL", "mongodb+srv://messmate:messmate123@messmate.rwjqtzz.mongodb.net/?appName=messmate&tlsAllowInvalidCertificates=true")
DB_NAME = os.environ.get("DB_NAME", "messmate")

# Password hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    users_col = db["users"]
    menus_col = db["menus"]
    necessary_info_col = db["necessary_info"]
    daily_plans_col = db["daily_plans"]
    settings_col = db["app_settings"]
    
    HOSTEL_NAME = "Global Hostel"
    
    print("Seeding starting...")
    
    # 1. Ensure Admin
    admin_email = "admin@messmate.com"
    existing_admin = await users_col.find_one({"email": admin_email})
    if not existing_admin:
        print("Creating admin...")
        admin_doc = {
            "id": str(uuid.uuid4()),
            "full_name": "Admin User",
            "email": admin_email,
            "password": get_password_hash(os.getenv("SEED_ADMIN_PASSWORD", "ChangeMe123!")),
            "role": "admin",
            "institution_or_hostel_name": HOSTEL_NAME,
            "approval_status": "approved",
            "email_verified": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        await users_col.insert_one(admin_doc)
    else:
        print("Admin exists.")

    # 2. Create 100 students
    print("Creating 100 students...")
    students = []
    # Fetch existing students to avoid duplicates if run multiple times
    existing_student_emails = set(doc["email"] for doc in await users_col.find({"role": "student", "institution_or_hostel_name": HOSTEL_NAME}).to_list(length=200))
    
    new_users = []
    for i in range(1, 101):
        email = f"student{i}@messmate.com"
        if email not in existing_student_emails:
            new_users.append({
                "id": str(uuid.uuid4()),
                "full_name": f"Student {i}",
                "email": email,
                "password": get_password_hash(os.getenv("SEED_STUDENT_PASSWORD", "ChangeMe123!")),
                "role": "student",
                "institution_or_hostel_name": HOSTEL_NAME,
                "approval_status": "approved",
                "email_verified": True,
                "room_number": f"{random.randint(100, 400)}",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
    
    if new_users:
        await users_col.insert_many(new_users)
        print(f"Inserted {len(new_users)} new students.")
    else:
        print("100 students already exist.")
        
    all_students = await users_col.find({"role": "student", "institution_or_hostel_name": HOSTEL_NAME}).to_list(length=200)

    # 3. Insert Weekly Menu Data (Mon-Sun)
    print("Setting up weekly menus...")
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    menu_items = {
        "breakfast": ["Idli", "Dosa", "Upma", "Poha", "Aloo Paratha", "Bread Omelette", "Puri Sabji"],
        "lunch": ["Rice, Dal, Paneer", "Veg Biryani", "Rice, Sambar, Cabbage", "Chapati, Rajma", "Lemon Rice", "Meals", "Chicken Biryani"],
        "dinner": ["Chapati, Dal Tadka", "Fried Rice", "Chapati, Chana Masala", "Noodles", "Roti, Mixed Veg", "Dosa", "Egg Curry"]
    }
    
    for idx, day in enumerate(days):
        await menus_col.update_one(
            {"day": day, "hostel": HOSTEL_NAME},
            {
                "$set": {
                    "day": day,
                    "hostel": HOSTEL_NAME,
                    "breakfast_items": [menu_items["breakfast"][idx]],
                    "lunch_items": [menu_items["lunch"][idx]],
                    "dinner_items": [menu_items["dinner"][idx]],
                    "updated_at": datetime.utcnow().isoformat()
                }
            },
            upsert=True
        )
    print("Menu setup complete.")

    # 4. Insert Necessary Info (Prices & Quantities) for all menu items
    print("Setting up necessary info...")
    items_to_add = []
    for meal in ["breakfast", "lunch", "dinner"]:
        for item in menu_items[meal]:
            items_to_add.append({
                "item_name": item,
                "meal_type": meal,
                "quantity_per_person": random.uniform(1.0, 2.5),
                "unit": "pieces" if "Idli" in item or "Dosa" in item or "Chapati" in item or "Puri" in item else "grams",
                "price_per_unit": random.randint(10, 50),
                "price_unit": "pieces" if "Idli" in item or "Dosa" in item or "Chapati" in item or "Puri" in item else "kg",
                "hostel": HOSTEL_NAME
            })
    
    await necessary_info_col.delete_many({"hostel": HOSTEL_NAME})
    await necessary_info_col.insert_many(items_to_add)
    print("Necessary info setup complete.")

    # 5. Simulate Daily Plans for tomorrow (student responses to notifications)
    print("Simulating student responses (daily plans) for tomorrow...")
    tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # We will simulate 80% students eating, 20% not eating
    plans_to_insert_or_update = []
    for student in all_students:
        will_eat = random.random() < 0.8
        status = "ON" if will_eat else "OFF"
        
        # Determine tomorrow's day name to pick selected items
        tomorrow_date = datetime.strptime(tomorrow, "%Y-%m-%d")
        day_name = tomorrow_date.strftime("%A").lower()
        day_index = days.index(day_name)
        
        b_item = menu_items["breakfast"][day_index]
        l_item = menu_items["lunch"][day_index]
        d_item = menu_items["dinner"][day_index]
        
        plan = {
            "user_id": student["id"],
            "date": tomorrow,
            "hostel": HOSTEL_NAME,
            "breakfast": {"status": status, "selected_items": [b_item] if will_eat else [], "reason_if_off": "" if will_eat else "Not hungry"},
            "lunch": {"status": status, "selected_items": [l_item] if will_eat else [], "reason_if_off": "" if will_eat else "Eating outside"},
            "dinner": {"status": status, "selected_items": [d_item] if will_eat else [], "reason_if_off": "" if will_eat else "Going home"},
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # update or insert
        await daily_plans_col.update_one(
            {"user_id": student["id"], "date": tomorrow},
            {"$set": plan},
            upsert=True
        )
    print(f"Simulated plans for {len(all_students)} students for date {tomorrow}.")

    print("Seed complete.")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed())
