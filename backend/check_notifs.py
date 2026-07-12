import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME")]

async def main():
    async for doc in db.notifications.find({}, {"_id": 0}):
        print(doc)
    print("Done")

asyncio.run(main())
