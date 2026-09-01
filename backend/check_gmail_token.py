"""
Quick diagnostic: tests whether the current GMAIL_REFRESH_TOKEN in .env
is still valid by hitting the Google OAuth2 token endpoint directly.
"""
import os
import json
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

env_path = Path(__file__).parent / ".env"
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

cid  = env.get("GMAIL_CLIENT_ID", "")
csec = env.get("GMAIL_CLIENT_SECRET", "")
rtok = env.get("GMAIL_REFRESH_TOKEN", "")

print("=" * 60)
print("  Gmail OAuth2 Token Diagnostic")
print("=" * 60)
print(f"  Client ID     : {cid[:30]}...")
print(f"  Client Secret : {csec[:15]}...")
print(f"  Refresh Token : {rtok[:20]}...")
print()

payload = urllib.parse.urlencode({
    "client_id": cid,
    "client_secret": csec,
    "refresh_token": rtok,
    "grant_type": "refresh_token",
}).encode()

req = urllib.request.Request(
    "https://oauth2.googleapis.com/token",
    data=payload,
    method="POST",
)

try:
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
        tok = resp.get("access_token", "")
        print("RESULT: SUCCESS — Refresh token is valid!")
        print(f"  access_token: {tok[:30]}...")
        print(f"  expires_in  : {resp.get('expires_in')} seconds")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"RESULT: FAILED — HTTP {e.code}")
    print(f"  Response: {body}")
    if "invalid_grant" in body:
        print()
        print("  The refresh token is REVOKED or EXPIRED.")
        print("  You must re-run:  python get_gmail_token.py")
except Exception as ex:
    print(f"RESULT: NETWORK ERROR — {ex}")
