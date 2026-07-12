import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test_mongo():
    try:
        client = AsyncIOMotorClient('mongodb://localhost:27017', serverSelectionTimeoutMS=2000)
        await client.server_info()
        print('MongoDB is running')
    except Exception as e:
        print('MongoDB is NOT running:', e)

asyncio.run(test_mongo())
