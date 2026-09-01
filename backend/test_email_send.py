"""
Tests the full Gmail send path using the same code path as the backend.
Sends a real OTP-style test email to elsewe.tech@gmail.com.
"""
import asyncio
import os
import json
import urllib.request
import urllib.parse
import urllib.error
import base64
from email.message import EmailMessage
from pathlib import Path

# Load .env manually
env_path = Path(__file__).parent / ".env"
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

GMAIL_CLIENT_ID     = env["GMAIL_CLIENT_ID"]
GMAIL_CLIENT_SECRET = env["GMAIL_CLIENT_SECRET"]
GMAIL_REFRESH_TOKEN = env["GMAIL_REFRESH_TOKEN"]
FROM_EMAIL          = env["FROM_EMAIL"]
FROM_NAME           = env.get("FROM_NAME", "MessMate")

print("=" * 60)
print("  Gmail End-to-End Email Send Test")
print("=" * 60)
print(f"  From : {FROM_NAME} <{FROM_EMAIL}>")
print(f"  To   : {FROM_EMAIL}  (self-test)")
print()

# Step 1: get access token
print("[1/3] Obtaining Gmail access token...")
payload = urllib.parse.urlencode({
    "client_id": GMAIL_CLIENT_ID,
    "client_secret": GMAIL_CLIENT_SECRET,
    "refresh_token": GMAIL_REFRESH_TOKEN,
    "grant_type": "refresh_token",
}).encode()

req = urllib.request.Request(
    "https://oauth2.googleapis.com/token",
    data=payload,
    method="POST",
)
try:
    with urllib.request.urlopen(req) as r:
        token_data = json.loads(r.read())
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"FAILED — HTTP {e.code}: {body}")
    raise SystemExit(1)

access_token = token_data["access_token"]
print(f"  ✓ access_token: {access_token[:30]}...")
print()

# Step 2: build MIME email
print("[2/3] Building OTP test email...")
TEST_OTP = "847291"
msg = EmailMessage()
msg["Subject"] = "MessMate — OTP Email Flow Test"
msg["From"]    = f"{FROM_NAME} <{FROM_EMAIL}>"
msg["To"]      = FROM_EMAIL  # self-send for verification
msg.set_content(
    f"Hello Admin,\n\n"
    f"This is a test OTP email from the MessMate backend.\n\n"
    f"Your test verification code is:\n\n"
    f"{TEST_OTP}\n\n"
    f"This confirms that the Gmail OAuth2 refresh token has been\n"
    f"successfully regenerated and email delivery is working.\n\n"
    f"Regards,\nMessMate Team"
)
msg.add_alternative(
    f"""<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;
max-width:520px;margin:auto;padding:32px;color:#0B1220">
<h2 style="margin:0 0 16px">Gmail OAuth2 Fix Verified ✓</h2>
<p>Hello <strong>Admin</strong>,</p>
<p>The Gmail OAuth2 refresh token has been successfully regenerated.</p>
<div style="font-size:36px;font-weight:700;letter-spacing:10px;
background:#EAFBF0;color:#15803D;padding:20px 24px;border-radius:12px;
text-align:center;margin:24px 0">{TEST_OTP}</div>
<p style="color:#5B6675">Email delivery is now working correctly.</p>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0" />
<p style="color:#9CA3AF;font-size:12px">Regards,<br/><strong>MessMate Team</strong></p>
</div>""",
    subtype="html",
)

raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
print("  ✓ Email message built")
print()

# Step 3: send via Gmail API
print("[3/3] Sending email via Gmail API...")
send_req = urllib.request.Request(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    data=json.dumps({"raw": raw}).encode(),
    headers={
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(send_req) as r:
        resp = json.loads(r.read())
        print(f"  ✓ Email sent! Gmail message id: {resp.get('id')}")
        print()
        print("=" * 60)
        print("  ALL TESTS PASSED ✓")
        print("  Check elsewe.tech@gmail.com inbox for the test email.")
        print("=" * 60)
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"  FAILED — HTTP {e.code}: {body}")
    raise SystemExit(1)
