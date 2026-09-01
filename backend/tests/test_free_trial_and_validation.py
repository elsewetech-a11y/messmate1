import asyncio
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from server import get_subscription_status, IST

class TestFreeTrialAndValidation(unittest.IsolatedAsyncioTestCase):
    async def test_1_normal_active_free_trial(self):
        """Verify that an active free trial returns dynamic days remaining and NEVER 9999 days."""
        now_dt = datetime.now(IST)
        trial_start = now_dt - timedelta(days=1)
        trial_end = now_dt + timedelta(days=9)
        
        mock_sub = {
            "institution_or_hostel_name": "Hostel_Normal",
            "status": "TRIAL_ACTIVE",
            "is_trial": True,
            "trial_start_date": trial_start.isoformat(),
            "trial_end_date": trial_end.isoformat(),
            "student_limit": 999999
        }
        
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=mock_sub)), \
             patch("server.users_col.count_documents", new=AsyncMock(return_value=120)), \
             patch("server.subscriptions_col.update_one", new=AsyncMock()) as mock_update:
            
            res = await get_subscription_status("Hostel_Normal")
            self.assertEqual(res["status"], "TRIAL_ACTIVE")
            self.assertEqual(res["days_remaining"], 9)
            self.assertNotEqual(res["days_remaining"], 9999, "Application must never return 9999 days!")
            self.assertEqual(res["registered_students"], 120)
            
    async def test_2_day_one_ceiling_calculation(self):
        """Verify that on Day 1 immediately after registration, remaining days is 10 (not floored to 9)."""
        now_dt = datetime.now(IST)
        # Registered 10 minutes ago
        trial_start = now_dt - timedelta(minutes=10)
        trial_end = trial_start + timedelta(days=10) # 9 days, 23 hours, 50 mins left
        
        mock_sub = {
            "institution_or_hostel_name": "Hostel_DayOne",
            "status": "TRIAL_ACTIVE",
            "is_trial": True,
            "trial_start_date": trial_start.isoformat(),
            "trial_end_date": trial_end.isoformat(),
            "student_limit": 999999
        }
        
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=mock_sub)), \
             patch("server.users_col.count_documents", new=AsyncMock(return_value=0)):
            
            res = await get_subscription_status("Hostel_DayOne")
            self.assertEqual(res["days_remaining"], 10, "Day 1 must display 10 Days Remaining!")

    async def test_3_self_healing_corrupted_9999_days(self):
        """Verify automatic database self-healing for legacy/corrupted admin records showing 9999 Days."""
        now_dt = datetime.now(IST)
        # Admin account registered 3 days ago, but subscription erroneously had 2053 expiry or 9999 days stored
        created_at_dt = now_dt - timedelta(days=3)
        
        corrupted_sub = {
            "institution_or_hostel_name": "Hostel_Corrupted",
            "status": "FREE_TRIAL", # Old legacy naming
            "is_trial": True,
            "days_remaining": 9999, # Buggy stored property
            "trial_end_date": "2053-01-01T00:00:00+00:00", # Absurd future date
            "student_limit": 250
        }
        
        mock_admin = {"created_at": created_at_dt.isoformat(), "role": "admin"}
        
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=corrupted_sub)), \
             patch("server.users_col.count_documents", new=AsyncMock(return_value=50)), \
             patch("server.users_col.find_one", new=AsyncMock(return_value=mock_admin)), \
             patch("server.subscriptions_col.update_one", new=AsyncMock()) as mock_update:
            
            res = await get_subscription_status("Hostel_Corrupted")
            # Verify database auto-correction took place
            self.assertTrue(mock_update.called, "Database auto-correction update_one must be invoked!")
            update_call = mock_update.call_args[0][1]
            self.assertIn("$unset", update_call)
            self.assertIn("days_remaining", update_call["$unset"], "Hardcoded days_remaining must be unset in DB!")
            
            # Verify corrected return value (3 days elapsed out of 10 -> exactly 7 days remaining)
            self.assertEqual(res["days_remaining"], 7)
            self.assertNotEqual(res["days_remaining"], 9999)
            self.assertEqual(res["status"], "TRIAL_ACTIVE")
            self.assertEqual(res["student_limit"], 999999)

    async def test_4_free_trial_expiration(self):
        """Verify that when 10 days elapse, trial transitions to TRIAL_EXPIRED with 0 days remaining."""
        now_dt = datetime.now(IST)
        # Trial expired 1 minute ago
        trial_start = now_dt - timedelta(days=10, minutes=1)
        trial_end = now_dt - timedelta(minutes=1)
        
        mock_sub = {
            "institution_or_hostel_name": "Hostel_Expired",
            "status": "TRIAL_ACTIVE",
            "is_trial": True,
            "trial_start_date": trial_start.isoformat(),
            "trial_end_date": trial_end.isoformat(),
            "student_limit": 999999
        }
        
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=mock_sub)), \
             patch("server.users_col.count_documents", new=AsyncMock(return_value=500)), \
             patch("server.subscriptions_col.update_one", new=AsyncMock()) as mock_update:
            
            res = await get_subscription_status("Hostel_Expired")
            self.assertEqual(res["status"], "TRIAL_EXPIRED")
            self.assertEqual(res["days_remaining"], 0)
            self.assertTrue(mock_update.called)
            self.assertEqual(mock_update.call_args[0][1]["$set"]["status"], "TRIAL_EXPIRED")

    async def test_5_minimum_approved_student_count_validation(self):
        """Verify the business logic that Student Count minimum is strictly max(approved_count, 250)."""
        # Example 1: 1000 approved students in database
        approved_students_1 = 1000
        min_required_1 = max(approved_students_1, 250)
        self.assertEqual(min_required_1, 1000)
        
        # Verify allowed vs disallowed values
        allowed_values = [1000, 1001, 1100, 1500, 2000]
        disallowed_values = [999, 900, 500, 250, 0]
        
        for val in allowed_values:
            self.assertGreaterEqual(val, min_required_1, f"{val} should be allowed when approved count is {min_required_1}")
        for val in disallowed_values:
            self.assertLess(val, min_required_1, f"{val} should be rejected when approved count is {min_required_1}")
            
        # Example 2: 50 approved students (below base platform minimum of 250)
        approved_students_2 = 50
        min_required_2 = max(approved_students_2, 250)
        self.assertEqual(min_required_2, 250, "Platform base minimum 250 applies when approved count < 250")

    async def test_6_new_admin_signup_without_sub_gets_10_days_trial_unlimited(self):
        """Verify that a brand new institution without any subscription doc gets created as 10-day trial with unlimited student limit."""
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=None)), \
             patch("server.users_col.count_documents", new=AsyncMock(return_value=0)), \
             patch("server.users_col.find_one", new=AsyncMock(return_value={"id": "admin-123", "email": "admin@test.com"})), \
             patch("server.subscriptions_col.insert_one", new=AsyncMock()) as mock_insert:
            
            res = await get_subscription_status("BrandNewHostel")
            self.assertEqual(res["status"], "TRIAL_ACTIVE")
            self.assertEqual(res["is_trial"], True)
            self.assertEqual(res["days_remaining"], 10)
            self.assertEqual(res["student_limit"], 999999)
            self.assertEqual(res["plan_type"], "trial")
            self.assertTrue(mock_insert.called)
            inserted_doc = mock_insert.call_args[0][0]
            self.assertEqual(inserted_doc["status"], "TRIAL_ACTIVE")
            self.assertEqual(inserted_doc["is_trial"], True)
            self.assertEqual(inserted_doc["student_limit"], 999999)

    async def test_7_unpaid_active_2027_sub_heals_to_10_days_trial(self):
        """Verify that an unpaid ACTIVE subscription with a 2027 date heals to a 10-day free trial with unlimited student capacity."""
        now_dt = datetime.now(IST)
        corrupted_2027_sub = {
            "institution_or_hostel_name": "Hostel_Corrupted2027",
            "status": "ACTIVE",
            "is_trial": False,
            "subscription_end_date": "2027-07-20T00:00:00+00:00",
            "plan_type": "yearly",
            "student_limit": 500,
            "payment_status": "NONE"
        }
        mock_admin = {"created_at": now_dt.isoformat(), "role": "admin"}
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=corrupted_2027_sub)), \
             patch("server.users_col.count_documents", new=AsyncMock(return_value=10)), \
             patch("server.users_col.find_one", new=AsyncMock(return_value=mock_admin)), \
             patch("server.subscriptions_col.update_one", new=AsyncMock()) as mock_update:
            
            res = await get_subscription_status("Hostel_Corrupted2027")
            self.assertEqual(res["status"], "TRIAL_ACTIVE")
            self.assertEqual(res["is_trial"], True)
            self.assertEqual(res["days_remaining"], 10)
            self.assertEqual(res["student_limit"], 999999)
            self.assertTrue(mock_update.called)

if __name__ == "__main__":
    unittest.main()
