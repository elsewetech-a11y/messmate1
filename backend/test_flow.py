import asyncio
import httpx

async def test_flow():
    # Fetch admin and student users from DB directly to grab emails and passwords
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017/')
    db = client['messmate_db']
    
    admin = await db['users'].find_one({'role': 'admin'})
    student = await db['users'].find_one({'role': 'student', 'approval_status': 'approved'})
    
    if not admin or not student:
        print("Missing users")
        return
        
    print(f"Admin: {admin['email']} | Student: {student['email']}")
    
    async with httpx.AsyncClient() as hc:
        # Admin login
        r = await hc.post("http://127.0.0.1:8000/api/auth/login", json={"email": admin['email'], "password": "password123"})
        if r.status_code != 200:
            print("Admin login failed", r.text)
            return
        admin_token = r.json()["access_token"]
        
        # Admin sends push
        r = await hc.post(
            "http://127.0.0.1:8000/api/admin/notifications/push/immediate", 
            json={"title": "Test Notif", "message": "Test Message"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print("Push sent:", r.status_code, r.text)
        
        # Student login
        r = await hc.post("http://127.0.0.1:8000/api/auth/login", json={"email": student['email'], "password": "password123"})
        if r.status_code != 200:
            print("Student login failed", r.text)
            return
        student_token = r.json()["access_token"]
        
        # Student fetches notifications
        r = await hc.get(
            "http://127.0.0.1:8000/api/student/notifications",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        print("Student notifications:", r.status_code)
        try:
            print(r.json())
        except:
            print(r.text)

asyncio.run(test_flow())
