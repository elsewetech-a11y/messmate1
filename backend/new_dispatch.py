async def _dispatch_scheduled_notifications() -> int:
    """Find active scheduled notifications whose time and day match the current time.
    Dispatch them to students and log the delivery.
    """
    now_dt = datetime.now(IST)
    today_str = now_dt.date().isoformat()
    current_time_str = now_dt.strftime("%H:%M")
    current_day = now_dt.strftime("%A") # e.g. "Monday"
    
    cursor = scheduled_notifications_col.find({
        "isActive": True,
        "scheduledTime": current_time_str
    })
    
    dispatched = 0
    async for doc in cursor:
        last_sent = doc.get("lastSentAt")
        # Prevent double sending in the same minute
        if last_sent and last_sent[:16] == now_dt.isoformat()[:16]:
            continue
            
        repeat_option = doc.get("repeatOption")
        days_selection = doc.get("daysSelection", [])
        
        should_send = False
        
        if repeat_option == "Send Once":
            should_send = True
        elif repeat_option == "Repeat Every Selected Day":
            if current_day in days_selection:
                should_send = True
        elif repeat_option == "Repeat Weekly":
            if current_day in days_selection:
                should_send = True
        else:
            # Fallback for old 'Weekly' or 'Daily'
            should_send = True

        if not should_send:
            continue
            
        # Send it!
        try:
            h = doc["hostel"]
            admin_id_val = doc.get("adminId")
            recipients = []
            if admin_id_val:
                async for user in users_col.find({
                    "role": "student",
                    "approval_status": "approved",
                    "$or": [{"admin_id": admin_id_val}, {"institution_or_hostel_name": h}]
                }):
                    recipients.append(user["id"])
            
            if recipients:
                docs = []
                now = now_iso()
                indian_months = ["January","February","March","April","May","June",
                                 "July","August","September","October","November","December"]
                indian_date = f"{now_dt.day:02d} {indian_months[now_dt.month-1]} {now_dt.year}"
                indian_day = now_dt.strftime("%A")
                indian_time = now_dt.strftime("%I:%M %p")
                for r_id in recipients:
                    docs.append({
                        "id": str(uuid.uuid4()),
                        "recipient_id": r_id,
                        "title": doc["title"],
                        "message": doc["message"],
                        "date": indian_date,
                        "day": indian_day,
                        "time": indian_time,
                        "created_at": now,
                        "read_status": False,
                        "sender_id": doc.get("adminId")
                    })
                
                await student_notifications_col.insert_many(docs)
                
                await notification_logs_col.insert_one({
                    "id": str(uuid.uuid4()),
                    "admin_id": doc.get("adminId"),
                    "hostel": h,
                    "title": doc["title"],
                    "type": "Scheduled",
                    "delivered_count": len(recipients),
                    "delivered_at": now
                })
                
                try:
                    await send_push(
                        recipients,
                        {"title": doc["title"], "message": doc["message"],
                         "subtext": "MessMate", "action_url": "/notifications"},
                        idempotency_key=str(uuid.uuid4()),
                    )
                except Exception as e:
                    logger.warning("scheduled push failed (%s): %s", doc.get("id"), e, exc_info=True)
            
            # Update lastSentAt
            await scheduled_notifications_col.update_one(
                {"id": doc["id"]},
                {
                    "$set": {"lastSentAt": now_dt.isoformat()},
                }
            )
            dispatched += 1
            
            # If One Time, mark inactive
            if repeat_option == "Send Once":
                await scheduled_notifications_col.update_one(
                    {"id": doc["id"]},
                    {"$set": {"isActive": False}}
                )
                
        except Exception as e:
            logger.warning(
                "scheduler dispatch failed for %s: %s",
                doc.get("id"),
                e, exc_info=True)
    return dispatched
