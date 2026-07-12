import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME")]

async def main():
    # Update admin to match the seeded students
    res1 = await db.users.update_one(
        {"email": "admin@messmate.com"}, 
        {"$set": {"institution_or_hostel_name": "Boys Hostel A"}}
    )
    # Update existing notifications to match
    res2 = await db.notifications.update_many(
        {}, 
        {"$set": {"hostel": "Boys Hostel A"}}
    )
    print(f"Updated Admin: {res1.modified_count}, Notifications: {res2.modified_count}")

asyncio.run(main())
