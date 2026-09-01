import asyncio
from server import db

async def test():
    try:
        await db.command("ping")
        print("DB OK")
    except Exception as e:
        print(f"DB Error: {e}")

asyncio.run(test())
