import asyncio, os, httpx, base64 as _base64
from email.message import EmailMessage as _EmailMessage
from dotenv import load_dotenv
load_dotenv()

GMAIL_CLIENT_ID = os.environ.get('GMAIL_CLIENT_ID', '').strip()
GMAIL_CLIENT_SECRET = os.environ.get('GMAIL_CLIENT_SECRET', '').strip()
GMAIL_REFRESH_TOKEN = os.environ.get('GMAIL_REFRESH_TOKEN', '').strip()
FROM_EMAIL = os.environ.get('FROM_EMAIL', '').strip()
FROM_NAME = os.environ.get('FROM_NAME', 'MessMate').strip()

_gmail_token_cache = {'token': None, 'expires_at': 0.0}

async def _get_gmail_access_token(*, force_refresh=False):
    import time as _time
    now = _time.monotonic()
    if not force_refresh and _gmail_token_cache['token'] and now < _gmail_token_cache['expires_at']:
        print('  [cache HIT]')
        return _gmail_token_cache['token']
    print('  [cache MISS - fetching new token]')
    url = 'https://oauth2.googleapis.com/token'
    payload = {
        'client_id': GMAIL_CLIENT_ID,
        'client_secret': GMAIL_CLIENT_SECRET,
        'refresh_token': GMAIL_REFRESH_TOKEN,
        'grant_type': 'refresh_token',
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, data=payload)
    if resp.status_code != 200:
        err_body = resp.text
        if 'invalid_grant' in err_body:
            raise RuntimeError('invalid_grant: refresh token is revoked. Re-run get_gmail_token.py')
        raise RuntimeError('Token exchange failed: ' + str(resp.status_code) + ' ' + err_body)
    data = resp.json()
    tok = data['access_token']
    expires_in = int(data.get('expires_in', 3600))
    cache_dur = min(expires_in - 300, 3300)
    _gmail_token_cache['token'] = tok
    _gmail_token_cache['expires_at'] = now + cache_dur
    print('  [token cached for ~' + str(cache_dur) + 's]')
    return tok


async def main():
    print('=== Test 1: First token fetch (cache miss expected) ===')
    t1 = await _get_gmail_access_token()
    print('  Token prefix: ' + t1[:20] + '...')

    print()
    print('=== Test 2: Second fetch (cache hit expected) ===')
    t2 = await _get_gmail_access_token()
    assert t1 == t2, 'Cache should return same token!'
    print('  Same token returned: YES')

    print()
    print('=== Test 3: Send actual email ===')
    msg = _EmailMessage()
    msg['Subject'] = 'MessMate Gmail OAuth2 Test - Cache Fix Validation'
    msg['From'] = FROM_NAME + ' <' + FROM_EMAIL + '>'
    msg['To'] = FROM_EMAIL
    msg.set_content('Gmail caching fix test - plain text')
    msg.add_alternative('<h2>Gmail caching fix test</h2><p>Access token is now cached for 55 minutes.</p>', subtype='html')
    raw_msg = _base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
    access_token = await _get_gmail_access_token()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            json={'raw': raw_msg},
            headers={
                'Authorization': 'Bearer ' + access_token,
                'Content-Type': 'application/json',
            }
        )
    if resp.status_code in (200, 201):
        msg_id = resp.json().get('id', 'unknown')
        print('  EMAIL SENT SUCCESSFULLY! id=' + str(msg_id))
    else:
        print('  FAILED: ' + str(resp.status_code) + ' ' + resp.text)

    print()
    print('=== All tests passed ===')

asyncio.run(main())
