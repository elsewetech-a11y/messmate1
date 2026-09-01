import asyncio
from fastapi.testclient import TestClient
from server import app, users_col, email_otps_col, db
import uuid
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def run_test():
    client = TestClient(app)
    
    unique_id = uuid.uuid4().hex[:6]
    admin_email = f"test_admin_{unique_id}@example.com"
    
    print(f"1. Registering new admin: {admin_email}")
    res = client.post("/api/auth/register", json={
        "full_name": "Test Admin",
        "email": admin_email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "admin",
        "institution_or_hostel_name": f"Test Hostel {unique_id}"
    })
    
    if res.status_code != 201:
        print(f"Failed to register: {res.status_code} {res.text}")
        return False
        
    print("Registration successful! Gmail email sending should have succeeded.")
    
    # 2. Overwrite the OTP hash in DB so we can verify it
    # We do this asynchronously, but TestClient is synchronous, so we need a small async helper
    async def override_otp():
        known_otp = "123456"
        otp_hash = pwd_context.hash(known_otp)
        await email_otps_col.update_one(
            {"email": admin_email, "purpose": "registration"},
            {"$set": {"otp_hash": otp_hash}}
        )
        return known_otp
        
    known_otp = asyncio.run(override_otp())
    print("Overwrote OTP hash in DB to simulate receiving email.")
    
    # 3. Verify OTP
    print("3. Verifying OTP...")
    res = client.post("/api/auth/verify-email", json={
        "email": admin_email,
        "otp": known_otp
    })
    
    if res.status_code != 200:
        print(f"Failed to verify OTP: {res.status_code} {res.text}")
        return False
        
    print("OTP Verification successful! Admin account verified.")
    
    # 4. Check for Free Trial Activation
    async def check_free_trial():
        user = await users_col.find_one({"email": admin_email})
        if not user:
            print("User not found in DB!")
            return False
            
        print(f"User approval_status: {user.get('approval_status')}")
        print(f"User plan: {user.get('plan')}")
        print(f"User trial_active: {user.get('trial_active')}")
        print(f"User trial_end: {user.get('trial_end')}")
        
        if user.get("plan") == "free_trial" and user.get("trial_active") == True:
            print("SUCCESS! Free trial is active.")
            return True
        else:
            print("FAILED! Free trial not active.")
            return False
            
    is_success = asyncio.run(check_free_trial())
    
    # Clean up test data
    async def cleanup():
        await users_col.delete_one({"email": admin_email})
        await email_otps_col.delete_many({"email": admin_email})
        
    asyncio.run(cleanup())
    
    return is_success

if __name__ == "__main__":
    success = run_test()
    if not success:
        exit(1)
    print("All tests passed.")
