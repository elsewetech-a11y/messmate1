import asyncio
import httpx
import uuid

async def test_reg():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000/api") as api:
        admin_email = f"test_admin_{uuid.uuid4().hex[:4]}@gmail.com"
        r = await api.post("/auth/register", json={
            "full_name": "Test Admin",
            "email": admin_email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "admin",
            "institution_or_hostel_name": "Test Hostel"
        })
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text}")

if __name__ == "__main__":
    asyncio.run(test_reg())
