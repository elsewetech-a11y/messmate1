import asyncio
import httpx
import os
import uuid
import time
from motor.motor_asyncio import AsyncIOMotorClient

API_URL = 'http://localhost:8000/api'
UNIQUE = int(time.time())

async def main():
    print(f"Starting Manual Flow Test against {API_URL}...")
    client = httpx.AsyncClient(timeout=20.0)
    
    mongo = AsyncIOMotorClient('mongodb://localhost:27017')
    db = mongo['messmate']

    # 1. Register Admin
    admin_email = f'admin_{UNIQUE}@example.com'
    TEST_PASSWORD = "Password123!"
    
    print(f"Registering Admin {admin_email}...")
    res = await client.post(f'{API_URL}/auth/register', json={
        'full_name': 'Test Admin', 'email': admin_email,
        'password': TEST_PASSWORD, 'confirm_password': TEST_PASSWORD,
        'institution_or_hostel_name': f'Hostel_{UNIQUE}', 'role': 'admin'
    })
    
    print("Admin registered, extracting OTP from backend logs...")
    
    # Read backend logs to find OTP
    log_path = r"C:\Users\kames\.gemini\antigravity-ide\brain\bfacd8d8-0a1b-4774-ad8b-9cdf76774e53\.system_generated\tasks\task-431.log"
    otp_code = None
    import re
    # Give it a second to flush logs
    await asyncio.sleep(2)
    with open(log_path, "r") as f:
        content = f.read()
        matches = re.findall(rf"to={admin_email} otp=(\d+)", content)
        if matches:
            otp_code = matches[-1]
            
    if not otp_code:
        print("NO OTP FOUND IN LOGS FOR ADMIN!")
        return
    print(f"Got Admin OTP: {otp_code}")
    
    # Verify OTP
    res = await client.post(f'{API_URL}/auth/verify-email', json={
        'email': admin_email, 'otp': otp_code
    })
    if res.status_code != 200:
        print('Admin OTP verify failed:', res.status_code, res.text)
        return
    print("Admin OTP Verified!")
    
    # Login Admin
    res = await client.post(f'{API_URL}/auth/login', json={'email': admin_email, 'password': TEST_PASSWORD})
    if 'access_token' not in res.json():
        print('Admin Login Failed:', res.text)
        return
    admin_token = res.json()['access_token']
    print("Admin logged in successfully.")
    
    # Check 10-day trial
    res = await client.get(f'{API_URL}/subscription/status', headers={'Authorization': f'Bearer {admin_token}'})
    sub_status = res.json()
    print("Subscription Status:", sub_status)
    if not sub_status.get("is_trial") or sub_status.get("days_remaining") != 10:
        print("ERROR: Free trial not correctly applied or days_remaining is not 10.")
    else:
        print("Free trial is ACTIVE and correctly applied!")
        
    # 2. Register 2 Students
    student_emails = [f'student1_{UNIQUE}@example.com', f'student2_{UNIQUE}@example.com']
    for email in student_emails:
        print(f"Registering Student {email}...")
        res = await client.post(f'{API_URL}/auth/register', json={
            'full_name': 'Test Student', 'email': email,
            'password': TEST_PASSWORD, 'confirm_password': TEST_PASSWORD,
            'institution_or_hostel_name': f'Hostel_{UNIQUE}', 'role': 'student'
        })
        
        await asyncio.sleep(2)
        otp_code = None
        with open(log_path, "r") as f:
            content = f.read()
            matches = re.findall(rf"to={email} otp=(\d+)", content)
            if matches:
                otp_code = matches[-1]
                
        if not otp_code:
            print("NO OTP FOUND IN LOGS FOR STUDENT!")
            continue
            
        res = await client.post(f'{API_URL}/auth/verify-email', json={
            'email': email, 'otp': otp_code
        })
        if res.status_code != 200:
            print(f'Student OTP verify failed:', res.text)
            
    print("Students registered and verified.")
    
    # 3. Admin Approves Students
    res = await client.get(f'{API_URL}/admin/students', headers={'Authorization': f'Bearer {admin_token}'})
    students = res.json().get('students', [])
    print(f"Admin found {len(students)} students.")
    
    for s in students:
        res = await client.post(f'{API_URL}/admin/students/{s["id"]}/approve', headers={'Authorization': f'Bearer {admin_token}'})
        print(f"Approve {s['email']} response:", res.status_code, res.json())
        
    # Check subscription status again
    res = await client.get(f'{API_URL}/subscription/status', headers={'Authorization': f'Bearer {admin_token}'})
    print("Subscription Status after approval:", res.json())
    
    # 4. Upgrade Subscription
    print("Simulating Subscription Purchase...")
    res = await client.post(f'{API_URL}/subscription/order', json={
        'plan_type': 'monthly',
        'student_count': 500
    }, headers={'Authorization': f'Bearer {admin_token}'})
    order_data = res.json()
    print("Order created:", order_data)
    
    res = await client.post(f'{API_URL}/subscription/verify-payment', json={
        'order_id': order_data["order_id"],
        'payment_id': 'mock_payment_123',
        'signature': 'mock_signature'
    }, headers={'Authorization': f'Bearer {admin_token}'})
    print("Payment verified:", res.json())
    
    res = await client.get(f'{API_URL}/subscription/status', headers={'Authorization': f'Bearer {admin_token}'})
    final_sub = res.json()
    print("Subscription Status after purchase:", final_sub)
    if final_sub.get("is_trial"):
        print("ERROR: Still in trial after purchase.")
    else:
        print("Purchase applied instantly!")
        
    # 5. Forgot Password
    print("Testing Forgot Password...")
    res = await client.post(f'{API_URL}/auth/forgot-password', json={'email': admin_email})
    print("Forgot Password Response:", res.status_code, res.json())
    
    await asyncio.sleep(2)
    otp_code = None
    with open(log_path, "r") as f:
        content = f.read()
        matches = re.findall(rf"purpose=forgot_password to={admin_email} otp=(\d+)", content)
        if matches:
            otp_code = matches[-1]
            
    if not otp_code:
        print("NO OTP FOUND IN LOGS FOR PASSWORD RESET!")
        return
        
    print(f"Got Reset OTP: {otp_code}")
    
    res = await client.post(f'{API_URL}/auth/reset-password', json={
        'email': admin_email,
        'otp': otp_code,
        'new_password': "NewPassword123!",
        'confirm_password': "NewPassword123!"
    })
    print("Reset Password Response:", res.status_code, res.json())
    
    # Try login with new password
    res = await client.post(f'{API_URL}/auth/login', json={'email': admin_email, 'password': "NewPassword123!"})
    if 'access_token' in res.json():
        print("Successfully logged in with new password!")
    else:
        print("Failed to login with new password:", res.text)
        
    print("All backend checks complete.")

asyncio.run(main())
