from enum import Enum
import os
from typing import List, Optional, Dict
from fastapi import HTTPException, Request
import bcrypt

# --- Monkey-patch for passlib compatibility with bcrypt >= 4.0 ---
try:
    if not hasattr(bcrypt, "__about__"):
        class __About:
            __version__ = "4.0.0"
        bcrypt.__about__ = __About()
except Exception:
    pass
# -----------------------------------------------------------------

from passlib.context import CryptContext
from jose import JWTError, jwt

class Role(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    FINANCE_ADMIN = "FINANCE_ADMIN"
    SUPPORT_ADMIN = "SUPPORT_ADMIN"
    INSTITUTION_ADMIN = "INSTITUTION_ADMIN"
    HOSTEL_ADMIN = "HOSTEL_ADMIN"
    STUDENT = "STUDENT"

class Permission(str, Enum):
    MANAGE_STUDENTS = "MANAGE_STUDENTS"
    MANAGE_MENUS = "MANAGE_MENUS"
    VIEW_REPORTS = "VIEW_REPORTS"
    MANAGE_SUBSCRIPTION = "MANAGE_SUBSCRIPTION"
    VIEW_MENU = "VIEW_MENU"
    SUBMIT_FEEDBACK = "SUBMIT_FEEDBACK"

ROLE_PERMISSIONS = {
    Role.SUPER_ADMIN: [p.value for p in Permission],
    Role.FINANCE_ADMIN: [Permission.VIEW_REPORTS.value, Permission.MANAGE_SUBSCRIPTION.value],
    Role.SUPPORT_ADMIN: [Permission.VIEW_REPORTS.value, Permission.MANAGE_STUDENTS.value],
    Role.INSTITUTION_ADMIN: [
        Permission.MANAGE_STUDENTS.value, 
        Permission.MANAGE_MENUS.value, 
        Permission.VIEW_REPORTS.value, 
        Permission.MANAGE_SUBSCRIPTION.value
    ],
    Role.HOSTEL_ADMIN: [
        Permission.MANAGE_STUDENTS.value, 
        Permission.MANAGE_MENUS.value, 
        Permission.VIEW_REPORTS.value
    ],
    Role.STUDENT: [
        Permission.VIEW_MENU.value,
        Permission.SUBMIT_FEEDBACK.value
    ]
}

def has_permission(user_role: str, permission: str) -> bool:
    role_enum = Role(user_role.upper()) if user_role.upper() in Role.__members__ else None
    
    # Map legacy roles
    if user_role == "admin":
        role_enum = Role.INSTITUTION_ADMIN
    elif user_role == "student":
        role_enum = Role.STUDENT
        
    if not role_enum:
        return False
        
    return permission in ROLE_PERMISSIONS.get(role_enum, [])

def create_rate_limiter():
    """
    Mock rate limiter using simple in-memory dict for demonstration.
    In production, use Redis or slowapi.
    """
    from collections import defaultdict
    import time
    
    limits = defaultdict(list)
    
    def check_rate_limit(request: Request, max_requests: int = 100, window_seconds: int = 60):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        
        # Clean old
        limits[client_ip] = [t for t in limits[client_ip] if now - t < window_seconds]
        
        if len(limits[client_ip]) >= max_requests:
            raise HTTPException(status_code=429, detail="Too many requests")
            
        limits[client_ip].append(now)
        
    return check_rate_limit

rate_limit = create_rate_limiter()
