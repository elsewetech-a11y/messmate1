import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(r'c:\Users\kames\mess mate\messmate1\backend\.env')
client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
db = client[os.getenv('DB_NAME')]

async def main():
    print('Admins:', await db.users.count_documents({'role': 'admin'}))
    print('Students:', await db.users.count_documents({'role': 'student'}))
    print('Student Notifs Total:', await db.student_notifications.count_documents({}))
    
    # Check if there are any notifications
    notifs = await db.student_notifications.find().to_list(10)
    for n in notifs:
        print("Notif:", n.get('recipient_id'), n.get('sender_id'), n.get('title'))
        
    print("Log notifs:", await db.notification_logs.count_documents({}))

asyncio.run(main())
