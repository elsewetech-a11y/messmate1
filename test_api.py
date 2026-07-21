import urllib.request
import urllib.error
import json

req = urllib.request.Request(
    'http://localhost:8000/api/subscription/order',
    method='POST',
    data=b'{"plan_type":"monthly","student_count":10}',
    headers={'Content-Type':'application/json'}
)

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code}")
    print(e.read().decode())
except Exception as e:
    print(f"Error: {e}")
