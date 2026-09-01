"""
Generates a new Gmail OAuth2 refresh token and automatically saves it to .env.

Run this script whenever the backend reports:
  "Failed to refresh Gmail token: 400 {"error": "invalid_grant"}"

This happens when:
  - The stored refresh token is revoked (e.g. Google account password changed,
    access was manually revoked, or the token was unused for 6 months).
  - The OAuth2 app is in "Testing" mode and the token expired after 7 days.

IMPORTANT: Run this script from the backend/ directory.
  cd backend
  pip install google-auth-oauthlib python-dotenv
  python get_gmail_token.py
"""

import os
import re
from google_auth_oauthlib.flow import InstalledAppFlow
from dotenv import load_dotenv

load_dotenv()

client_id = os.environ.get("GMAIL_CLIENT_ID")
client_secret = os.environ.get("GMAIL_CLIENT_SECRET")

if not client_id or not client_secret:
    print("ERROR: GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET missing in .env file!")
    exit(1)

print("=" * 60)
print("  MessMate - Gmail OAuth2 Refresh Token Generator")
print("=" * 60)
print()
print(f"  Using Client ID: {client_id[:30]}...")
print()
print("  IMPORTANT: When the browser opens, make sure you:")
print("  1. Sign in with the Gmail account configured as FROM_EMAIL")
print("  2. Grant ALL requested permissions")
print("  3. Click 'Advanced' -> 'Go to MessMate (unsafe)' if warned")
print()

client_config = {
    "installed": {
        "client_id": client_id,
        "client_secret": client_secret,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost"],
    }
}

SCOPES = ["https://mail.google.com/"]

flow = InstalledAppFlow.from_client_config(client_config, SCOPES)

# access_type="offline"  → Google returns a refresh token (not just an access token)
# prompt="consent"       → Forces the consent screen even if the user previously
#                          authorized this app; this guarantees a FRESH refresh token
#                          is returned rather than reusing an old (possibly revoked) one.
#                          Without this, Google may skip the consent screen and return
#                          no refresh_token at all, causing invalid_grant later.
creds = flow.run_local_server(
    port=0,
    open_browser=True,
    access_type="offline",
    prompt="consent",
)

new_token = creds.refresh_token

if not new_token:
    print()
    print("ERROR: Google did not return a refresh token.")
    print()
    print("To fix this, go to:")
    print("  https://myaccount.google.com/permissions")
    print("Find 'MessMate' (or your OAuth2 app name), click it, and click")
    print("'Remove Access'. Then run this script again.")
    exit(1)

print()
print("SUCCESS! New Gmail Refresh Token received.")
print("=" * 60)
print(new_token)
print("=" * 60)

# Automatically update .env file
env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(env_path, "r") as f:
    env_content = f.read()

new_env_content = re.sub(
    r"GMAIL_REFRESH_TOKEN=.*",
    f"GMAIL_REFRESH_TOKEN={new_token}",
    env_content,
)

with open(env_path, "w") as f:
    f.write(new_env_content)

print()
print("✓ backend/.env has been updated automatically.")
print()
print("NEXT STEPS:")
print("  1. If you deploy on Render.com, update the GMAIL_REFRESH_TOKEN")
print("     environment variable there too (Dashboard -> Service -> Environment).")
print("  2. Restart the backend server so it picks up the new token.")
print()
