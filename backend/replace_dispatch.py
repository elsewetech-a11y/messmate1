import re
import sys

with open('backend/server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('backend/new_dispatch.py', 'r', encoding='utf-8') as f:
    new_content = f.read()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if line.startswith('async def _dispatch_recurring_notifications() -> int:'):
        start_idx = i
        break

for i in range(start_idx, len(lines)):
    if line.startswith('async def _scheduler_loop() -> None:'):
        end_idx = i
        break

if start_idx == -1 or end_idx == -1:
    print("Could not find boundaries")
    sys.exit(1)

print(f"Replacing lines {start_idx} to {end_idx}")

new_lines = lines[:start_idx] + [new_content + "\n\n"] + lines[end_idx:]

# Also fix the _scheduler_loop to call the new function
for i in range(len(new_lines)):
    if 'await _dispatch_due_notifications()' in new_lines[i]:
        new_lines[i] = new_lines[i].replace('await _dispatch_due_notifications()', 'await _dispatch_scheduled_notifications()')
    if 'SCHEDULER_INTERVAL_SEC = int' in new_lines[i] and '30' in new_lines[i+3]:
        # Actually it's better to update interval to 60 directly using a regex or simple replace
        pass

with open('backend/server.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Success")
