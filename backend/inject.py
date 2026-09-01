import sys

with open("c:\\Users\\kames\\mess mate\\messmate1\\backend\\server.py", "r", encoding="utf-8") as f:
    content = f.read()

def replace_once(old, new):
    global content
    if old not in content:
        print(f"FAILED to find:\n{old}")
    else:
        content = content.replace(old, new)
        print("Replaced successfully")

replace_once(
    'return {"ok": True, "plan": project_plan(saved)}',
    'asyncio.create_task(ws_manager.broadcast_to_role(hostel_of(u), "admin", {"type": "student_action"}))\n    return {"ok": True, "plan": project_plan(saved)}'
)
replace_once(
    'return {"ok": True, "created_at": now}',
    'asyncio.create_task(ws_manager.broadcast_to_role(hostel_of(u), "admin", {"type": "student_action"}))\n    return {"ok": True, "created_at": now}'
)

replace_once(
    'return {"ok": True, "status": "approved"}',
    'asyncio.create_task(ws_manager.broadcast_to_user(sid, {"type": "account_status_changed"}))\n        asyncio.create_task(ws_manager.broadcast_to_role(h, "admin", {"type": "admin_action"}))\n        return {"ok": True, "status": "approved"}'
)
replace_once(
    'return {"ok": True, "status": "approved", "message": "Approved"}',
    'asyncio.create_task(ws_manager.broadcast_to_user(sid, {"type": "account_status_changed"}))\n    asyncio.create_task(ws_manager.broadcast_to_role(h, "admin", {"type": "admin_action"}))\n    return {"ok": True, "status": "approved", "message": "Approved"}'
)

# Reject
replace_once(
    'return {"ok": True}\n\n    res = await users_col.update_one(',
    'asyncio.create_task(ws_manager.broadcast_to_user(sid, {"type": "account_status_changed"}))\n        asyncio.create_task(ws_manager.broadcast_to_role(h, "admin", {"type": "admin_action"}))\n        return {"ok": True}\n\n    res = await users_col.update_one('
)
replace_once(
    'return {"ok": True}\n\n@api.post("/admin/students/{sid}/block")',
    'asyncio.create_task(ws_manager.broadcast_to_user(sid, {"type": "account_status_changed"}))\n    asyncio.create_task(ws_manager.broadcast_to_role(h, "admin", {"type": "admin_action"}))\n    return {"ok": True}\n\n@api.post("/admin/students/{sid}/block")'
)

# Block
replace_once(
    'return {"ok": True, "message": "Student blocked"}',
    'asyncio.create_task(ws_manager.broadcast_to_user(sid, {"type": "account_status_changed"}))\n    asyncio.create_task(ws_manager.broadcast_to_role(h, "admin", {"type": "admin_action"}))\n    return {"ok": True, "message": "Student blocked"}'
)

# Remove
replace_once(
    'return {"ok": True, "message": "Student removed"}',
    'asyncio.create_task(ws_manager.broadcast_to_user(sid, {"type": "account_status_changed"}))\n        asyncio.create_task(ws_manager.broadcast_to_role(h, "admin", {"type": "admin_action"}))\n        return {"ok": True, "message": "Student removed"}'
)

# What about menus?
# admin_menu_upsert around line 3330
replace_once(
    'return project_menu(saved)',
    'asyncio.create_task(ws_manager.broadcast_to_institution(h, {"type": "admin_action"}))\n    return project_menu(saved)'
)
replace_once(
    'return {"ok": True, "wastage": saved}',
    'asyncio.create_task(ws_manager.broadcast_to_institution(h, {"type": "admin_action"}))\n    return {"ok": True, "wastage": saved}'
)
replace_once(
    'return {"ok": True, "notification_id": doc["id"]}',
    'asyncio.create_task(ws_manager.broadcast_to_institution(hostel_of(u), {"type": "admin_action"}))\n    return {"ok": True, "notification_id": doc["id"]}'
)

with open("c:\\Users\\kames\\mess mate\\messmate1\\backend\\server.py", "w", encoding="utf-8") as f:
    f.write(content)
