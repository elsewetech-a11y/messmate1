@api.get("/admin/notifications")
async def admin_notifications(u: dict = Depends(require_active_subscription_admin)):
    h = hostel_of(u)
    items = []
    cursor = admin_notifications_col.find(
        {"institution_or_hostel_name": h}, {"_id": 0}
    ).sort("created_at", -1).limit(100)
    async for d in cursor:
        items.append(d)
    return {"items": items}

@api.post("/admin/notifications/{notif_id}/read")
async def mark_admin_notif_read(notif_id: str, u: dict = Depends(require_active_subscription_admin)):
    res = await admin_notifications_col.update_one(
        {"id": notif_id, "institution_or_hostel_name": hostel_of(u)},
        {"$set": {"read_status": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@api.delete("/admin/notifications/{notif_id}")
async def delete_admin_notif(notif_id: str, u: dict = Depends(require_active_subscription_admin)):
    res = await admin_notifications_col.delete_one(
        {"id": notif_id, "institution_or_hostel_name": hostel_of(u)}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@api.post("/admin/notifications/clear")
async def clear_admin_notifs(u: dict = Depends(require_active_subscription_admin)):
    await admin_notifications_col.delete_many({"institution_or_hostel_name": hostel_of(u)})
    return {"ok": True}


# --- STUDENT NOTIFICATIONS ---
@api.get("/student/notifications")
async def student_notifications(u: dict = Depends(require_approved_student)):
    items = []
    admin_id = u.get("admin_id")
    if not admin_id:
        return {"items": [], "unread_count": 0}
        
    cursor = student_notifications_col.find(
        {"recipient_id": u["id"], "sender_id": admin_id}, {"_id": 0}
    ).sort("created_at", -1).limit(50)
    async for d in cursor:
        items.append(d)
    unread = sum(1 for i in items if not i.get("read_status"))
    return {"items": items, "unread_count": unread}

@api.post("/student/notifications/{notif_id}/read")
async def mark_student_notif_read(notif_id: str, u: dict = Depends(require_approved_student)):
    admin_id = u.get("admin_id")
    if not admin_id:
        raise HTTPException(status_code=403, detail="No admin connected")
        
    res = await student_notifications_col.update_one(
        {"id": notif_id, "recipient_id": u["id"], "sender_id": admin_id},
        {"$set": {"read_status": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@api.delete("/student/notifications/{notif_id}")
async def delete_student_notif(notif_id: str, u: dict = Depends(require_approved_student)):
    admin_id = u.get("admin_id")
    if not admin_id:
        raise HTTPException(status_code=403, detail="No admin connected")
        
    res = await student_notifications_col.delete_one(
        {"id": notif_id, "recipient_id": u["id"], "sender_id": admin_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@api.post("/student/notifications/clear")
async def clear_student_notifs(u: dict = Depends(require_approved_student)):
    admin_id = u.get("admin_id")
    if admin_id:
        await student_notifications_col.delete_many({"recipient_id": u["id"], "sender_id": admin_id})
    return {"ok": True}


# --- PUSH CENTRE (ADMIN -> STUDENT) ---

class PushImmediateRequest(BaseModel):
    title: str
    message: str

@api.post("/admin/notifications/push/immediate")
async def admin_push_immediate(payload: PushImmediateRequest, u: dict = Depends(require_active_subscription_admin)):
    now = now_iso()
    h = hostel_of(u)
    
    recipients = []
    async for user in users_col.find({
        "role": "student",
        "approval_status": "approved",
        "$or": [{"admin_id": u["id"]}, {"institution_or_hostel_name": h}]
    }):
        recipients.append(user["id"])
    
    docs = []
    now_dt = datetime.now(IST)
    indian_months = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"]
    indian_date = f"{now_dt.day:02d} {indian_months[now_dt.month-1]} {now_dt.year}"
    indian_day = now_dt.strftime("%A")
    indian_time = now_dt.strftime("%I:%M %p")
    for r_id in recipients:
        docs.append({
            "id": str(uuid.uuid4()),
            "recipient_id": r_id,
            "title": payload.title.strip(),
            "message": payload.message.strip(),
            "date": indian_date,
            "day": indian_day,
            "time": indian_time,
            "created_at": now,
            "read_status": False,
            "sender_id": u["id"]
        })
    
    if docs:
        await student_notifications_col.insert_many(docs)
        
    await notification_logs_col.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": u["id"],
        "hostel": h,
        "title": payload.title.strip(),
        "type": "Immediate",
        "delivered_count": len(recipients),
        "delivered_at": now
    })
    
    try:
        await send_push(recipients, {
            "title": payload.title.strip(), 
            "message": payload.message.strip(),
            "subtext": "MessMate",
            "action_url": "/notifications"
        })
    except Exception:
        pass
        
    return {"ok": True, "delivered_count": len(recipients)}

@api.post("/admin/notifications/push/schedule")
async def admin_push_schedule(payload: ScheduledNotificationPublic, u: dict = Depends(require_active_subscription_admin)):
    doc = payload.model_dump()
    if not doc.get("id"):
        doc["id"] = str(uuid.uuid4())
    doc["hostel"] = hostel_of(u)
    doc["adminId"] = u["id"]
    if not doc.get("created_at"):
        doc["created_at"] = now_iso()
    doc["lastSentAt"] = None
    
    await scheduled_notifications_col.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/admin/notifications/push/schedule")
async def admin_push_schedule_list(u: dict = Depends(require_active_subscription_admin)):
    items = []
    cursor = scheduled_notifications_col.find(
        {"hostel": hostel_of(u)}, {"_id": 0}
    ).sort("created_at", -1)
    async for d in cursor:
        items.append(d)
    return {"items": items}

@api.put("/admin/notifications/push/schedule/{nid}")
async def admin_push_schedule_update(nid: str, payload: ScheduledNotificationPublic, u: dict = Depends(require_active_subscription_admin)):
    updates = payload.model_dump(exclude_unset=True)
    if "id" in updates:
        del updates["id"]
        
    res = await scheduled_notifications_col.update_one(
        {"id": nid, "hostel": hostel_of(u)},
        {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    
    doc = await scheduled_notifications_col.find_one({"id": nid}, {"_id": 0})
    return doc

@api.delete("/admin/notifications/push/schedule/{nid}")
async def admin_push_schedule_delete(nid: str, u: dict = Depends(require_active_subscription_admin)):
    res = await scheduled_notifications_col.delete_one({"id": nid, "hostel": hostel_of(u)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}

@api.post("/admin/notifications/push/test")
async def admin_push_test(payload: PushImmediateRequest, u: dict = Depends(require_active_subscription_admin)):
    h = hostel_of(u)
    recipients = []
    async for user in users_col.find({"role": "student", "approval_status": "approved", "institution_or_hostel_name": h}):
        recipients.append(user["id"])
        
    docs = []
    now_dt = datetime.now(IST)
    for r_id in recipients:
        docs.append({
            "id": str(uuid.uuid4()),
            "recipient_id": r_id,
            "title": "[TEST] " + payload.title.strip(),
            "message": payload.message.strip(),
            "date": now_dt.strftime("%Y-%m-%d"),
            "time": now_dt.strftime("%I:%M %p"),
            "created_at": now_iso(),
            "read_status": False,
            "sender_id": u["id"]
        })
    
    if docs:
        await student_notifications_col.insert_many(docs)
    
    return {"ok": True, "delivered_count": len(recipients)}

