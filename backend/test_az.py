import asyncio
import httpx
import os
import uuid
import time
from motor.motor_asyncio import AsyncIOMotorClient

API_URL = 'http://localhost:8000/api'
UNIQUE = int(time.time())

async def main():
    TEST_PASSWORD = os.getenv("TEST_PASSWORD", f"Pass_{uuid.uuid4().hex[:8]}!")
    print(f"Starting A-Z tests against {API_URL}...")
    client = httpx.AsyncClient(timeout=20.0)
    
    mongo = AsyncIOMotorClient('mongodb://localhost:27017')
    db = mongo['messmate']

    # 1. Register Admin
    print('Registering Admin...')
    admin_email = f'admin_{UNIQUE}@example.com'
    res = await client.post(f'{API_URL}/auth/register', json={
        'full_name': 'Test Admin', 'email': admin_email,
        'password': TEST_PASSWORD, 'confirm_password': TEST_PASSWORD,
        'institution_or_hostel_name': f'Hostel_{UNIQUE}', 'role': 'admin'
    })
    if res.status_code != 201: print('Admin register failed:', res.status_code, res.text); return
    
    # 2. Register 10 Students
    print('Registering 10 Students...')
    student_emails = [f'student{i}_{UNIQUE}@example.com' for i in range(1, 11)]
    for i, email in enumerate(student_emails):
        res = await client.post(f'{API_URL}/auth/register', json={
            'full_name': f'Student {i+1}', 'email': email,
            'password': TEST_PASSWORD, 'confirm_password': TEST_PASSWORD,
            'institution_or_hostel_name': f'Hostel_{UNIQUE}', 'role': 'student'
        })
        if res.status_code != 201: print(f'Student {i} register failed:', res.status_code, res.text); return

    # Bypass Email Verification in DB
    print('Bypassing Email Verification...')
    await db.users.update_many({'email': admin_email}, {'$set': {'email_verified': True}})
    await db.pending_requests.update_many({'email': {'$in': student_emails}}, {'$set': {'email_verified': True}})
    
    # Login Admin
    print('Logging in Admin...')
    res = await client.post(f'{API_URL}/auth/login', json={'email': admin_email, 'password': TEST_PASSWORD})
    if 'access_token' not in res.json(): print('Admin Login Failed:', res.text); return
    admin_token = res.json()['access_token']

    # 3. Admin Approves all Students
    print('Admin fetching pending students...')
    res = await client.get(f'{API_URL}/admin/students', headers={'Authorization': f'Bearer {admin_token}'})
    students = res.json().get('students', [])
    for s in students:
        res = await client.post(f'{API_URL}/admin/students/{s["id"]}/approve', headers={'Authorization': f'Bearer {admin_token}'})
        if res.status_code != 200: print(f'Approve {s["email"]} failed:', res.text); return
    print('All students approved!')

    # Login All Students
    student_tokens = []
    for email in student_emails:
        res = await client.post(f'{API_URL}/auth/login', json={'email': email, 'password': TEST_PASSWORD})
        if 'access_token' not in res.json(): print(f'Student {email} login failed:', res.text); return
        student_tokens.append(res.json()['access_token'])
    
    # 4. Admin Sets Menu & Daily Plan
    print('Admin setting menu and plan...')
    res = await client.put(f'{API_URL}/admin/menus/Monday', json={
        'id': 'mon', 'dayOfWeek': 'Monday', 'isActive': True,
        'breakfast': [{'name': 'Idli', 'isDefaultOn': True}],
        'lunch': [{'name': 'Rice', 'isDefaultOn': True}],
        'dinner': [{'name': 'Chapati', 'isDefaultOn': True}]
    }, headers={'Authorization': f'Bearer {admin_token}'})
    if res.status_code != 200: print('Menu creation failed:', res.text)
    
    # 5. Student Operations
    print('Student getting today...')
    res = await client.get(f'{API_URL}/student/today', headers={'Authorization': f'Bearer {student_tokens[0]}'})
    if res.status_code != 200: print('Student today failed:', res.text)
    
    # Set preference
    print('Student setting preference...')
    res = await client.post(f'{API_URL}/student/today', json={
        'date': '2026-07-08', 'meal_type': 'breakfast', 'status': 'OFF'
    }, headers={'Authorization': f'Bearer {student_tokens[0]}'})
    if res.status_code != 200: print('Student preference failed:', res.text)

    # 6. Admin Dashboard Stats
    print('Admin getting today stats...')
    res = await client.get(f'{API_URL}/admin/today', headers={'Authorization': f'Bearer {admin_token}'})
    if res.status_code != 200: print('Admin stats failed:', res.text)
    print('A-Z Test Completed Successfully!')

asyncio.run(main())
