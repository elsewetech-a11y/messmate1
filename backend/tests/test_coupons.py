import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server import apply_coupon, ApplyCouponRequest, IST

class TestCouponCodes(unittest.IsolatedAsyncioTestCase):
    async def test_apply_coupon_mm10d(self):
        mock_sub = None
        mock_u = {"id": "admin-1", "institution_or_hostel_name": "Test Hostel", "role": "admin"}
        
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=mock_sub)), \
             patch("server.subscriptions_col.insert_one", new=AsyncMock()) as mock_insert, \
             patch("server.transactions_col.insert_one", new=AsyncMock()):
            
            req = ApplyCouponRequest(coupon_code="MM10D")
            res = await apply_coupon(req, mock_u)
            
            self.assertTrue(res["ok"])
            self.assertIn("10", res["message"])
            mock_insert.assert_called_once()
            inserted = mock_insert.call_args[0][0]
            self.assertEqual(inserted["status"], "ACTIVE")
            self.assertFalse(inserted["is_trial"])

    async def test_apply_coupon_mm01m(self):
        mock_sub = {
            "id": "sub-1",
            "institution_or_hostel_name": "Test Hostel",
            "status": "TRIAL_EXPIRED",
            "expiry_date": (datetime.now(IST) - timedelta(days=1)).isoformat()
        }
        mock_u = {"id": "admin-1", "institution_or_hostel_name": "Test Hostel", "role": "admin"}
        
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=mock_sub)), \
             patch("server.subscriptions_col.update_one", new=AsyncMock()) as mock_update, \
             patch("server.transactions_col.insert_one", new=AsyncMock()):
            
            req = ApplyCouponRequest(coupon_code="mm01m")
            res = await apply_coupon(req, mock_u)
            
            self.assertTrue(res["ok"])
            self.assertIn("30", res["message"])
            mock_update.assert_called_once()
            update_set = mock_update.call_args[0][1]["$set"]
            self.assertEqual(update_set["status"], "ACTIVE")
            self.assertFalse(update_set["is_trial"])

    async def test_apply_coupon_mm05m(self):
        mock_sub = None
        mock_u = {"id": "admin-1", "institution_or_hostel_name": "Test Hostel", "role": "admin"}
        
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=mock_sub)), \
             patch("server.subscriptions_col.insert_one", new=AsyncMock()) as mock_insert, \
             patch("server.transactions_col.insert_one", new=AsyncMock()):
            
            req = ApplyCouponRequest(coupon_code="MM05M")
            res = await apply_coupon(req, mock_u)
            
            self.assertTrue(res["ok"])
            self.assertIn("150", res["message"])

    async def test_apply_coupon_mm01m2000_adds_days_and_capacity(self):
        """Verify that MM01M2000 adds 30 days and 2000 student capacity to an existing active plan."""
        now_dt = datetime.now(IST)
        existing_sub = {
            "id": "sub-1",
            "institution_or_hostel_name": "Test Hostel",
            "status": "ACTIVE",
            "is_trial": False,
            "student_limit": 500,
            "expiry_date": (now_dt + timedelta(days=10)).isoformat(),
            "subscription_end_date": (now_dt + timedelta(days=10)).isoformat()
        }
        mock_u = {"id": "admin-1", "institution_or_hostel_name": "Test Hostel", "role": "admin"}
        
        with patch("server.subscriptions_col.find_one", new=AsyncMock(return_value=existing_sub)), \
             patch("server.subscriptions_col.update_one", new=AsyncMock()) as mock_update, \
             patch("server.transactions_col.insert_one", new=AsyncMock()):
            
            req = ApplyCouponRequest(coupon_code="MM01M2000")
            res = await apply_coupon(req, mock_u)
            
            self.assertTrue(res["ok"])
            self.assertIn("30", res["message"])
            self.assertIn("2000", res["message"])
            mock_update.assert_called_once()
            update_set = mock_update.call_args[0][1]["$set"]
            self.assertEqual(update_set["status"], "ACTIVE")
            self.assertFalse(update_set["is_trial"])
            self.assertEqual(update_set["student_limit"], 2500, "500 existing + 2000 added must equal 2500")

    async def test_apply_invalid_coupon(self):
        mock_u = {"id": "admin-1", "institution_or_hostel_name": "Test Hostel", "role": "admin"}
        req = ApplyCouponRequest(coupon_code="INVALID_CODE")
        
        with self.assertRaises(HTTPException) as ctx:
            await apply_coupon(req, mock_u)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Invalid coupon code", ctx.exception.detail)
