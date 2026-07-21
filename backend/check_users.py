import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
async def run():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017/')
    db = client['messmate']
    users = await db['users'].find().to_list(100)
    for u in users:
        print(f"{u.get('role')} | {u.get('email')} | {u.get('institution_or_hostel_name')} | {u.get('admin_id')}")
asyncio.run(run())
