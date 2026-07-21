import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
async def run():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017/')
    db = client['messmate']
    admins = await db['users'].find({'role': 'admin'}).to_list(100)
    for u in admins:
        print(f"{u.get('email')} | {u.get('institution_or_hostel_name')} | {u.get('id')}")
asyncio.run(run())
