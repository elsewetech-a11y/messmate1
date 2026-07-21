import re
import sys

with open('backend/server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('backend/new_routes.py', 'r', encoding='utf-8') as f:
    new_content = f.read()

# Find start and end
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if line.startswith('@api.get("/student/notifications")'):
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start_idx")
    sys.exit(1)

for i in range(start_idx, len(lines)):
    if line.startswith('# ---------------------------------------------------------------------------') and 'ADMIN: Students' in lines[i+1]:
        end_idx = i
        break

if end_idx == -1:
    # Try finding the exact menu-reminder push failed line
    for i in range(start_idx, len(lines)):
        if 'logger.warning("menu-reminder push failed: %s", e)' in lines[i]:
            # The return statement is 1 line after it.
            end_idx = i + 2
            break

if end_idx == -1:
    print("Could not find end_idx")
    sys.exit(1)

print(f"Replacing lines {start_idx} to {end_idx}")

new_lines = lines[:start_idx] + [new_content + "\n"] + lines[end_idx:]

with open('backend/server.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Success")
