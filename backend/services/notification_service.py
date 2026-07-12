import uuid
from datetime import datetime, timezone

from typing import Optional

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

async def create_in_app_notification(
    db, 
    institution_name: str, 
    category: str, 
    title: str, 
    description: str,
    action_url: Optional[str] = None
):
    """
    Creates an in-app notification in the database.
    """
    notification = {
        "id": str(uuid.uuid4()),
        "institution_or_hostel_name": institution_name,
        "category": category,
        "title": title,
        "description": description,
        "created_at": now_iso(),
        "read_status": False,
        "action_url": action_url
    }
    await db["notifications"].insert_one(notification)
    return notification

async def notify_institution(db, institution_name: str, category: str, title: str, description: str, template_name: str, context: dict, action_url: Optional[str] = None):
    """
    Core engine to dispatch a notification via configured channels.
    """
    # 1. Check Preferences
    sub = await db["subscriptions"].find_one({"institution_or_hostel_name": institution_name})
    if not sub:
        return
        
    preferences = sub.get("communication_preferences", {})
    
    # 2. In-App Notification (Always generated)
    await create_in_app_notification(db, institution_name, category, title, description, action_url)
    
    # 3. Email Notification
    if preferences.get("email_notifications", True):
        # Specific overrides
        if category == "CAPACITY" and not preferences.get("capacity_alerts", True):
            pass
        elif category == "SUBSCRIPTION" and not preferences.get("renewal_reminders", True):
            pass
        elif category == "PAYMENT" and not preferences.get("payment_confirmations", True):
            pass
        else:
            # Find billing contact or admin email
            to_email = None
            if sub.get("billing_contact") and sub["billing_contact"].get("email"):
                to_email = sub["billing_contact"]["email"]
            else:
                # Fallback to institution admin
                admin = await db["users"].find_one({"institution_or_hostel_name": institution_name, "role": "admin"})
                if admin:
                    to_email = admin.get("email")
            
            if to_email:
                from .email_service import send_email
                await send_email(to_email, title, template_name, context)
                
    # 4. Push Notification (FCM Mock)
    if preferences.get("push_notifications", True):
        print(f"--- MOCK PUSH NOTIFICATION ---")
        print(f"To: {institution_name} Admins")
        print(f"Title: {title}")
        print(f"Body: {description}")
        print(f"------------------------------")
