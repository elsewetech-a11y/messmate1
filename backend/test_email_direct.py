import asyncio
import os
from server import _gmail_send_async, GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID

async def test_email():
    try:
        print(f"Using Client ID: {GMAIL_CLIENT_ID[:15]}...")
        print(f"Using Refresh Token: {GMAIL_REFRESH_TOKEN[:15]}...")
        
        await _gmail_send_async(
            to="elsewe.tech@gmail.com",
            subject="Test Email from Backend",
            html="<h1>Test</h1>",
            text="Test"
        )
        print("EMAIL SENT SUCCESSFULLY!")
    except Exception as e:
        print(f"FAILED TO SEND EMAIL: {type(e).__name__} - {e}")

if __name__ == "__main__":
    asyncio.run(test_email())
