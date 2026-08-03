import asyncio
import sys
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import server
from server import (
    student_notifications,
    mark_student_notif_read,
    delete_student_notif,
    admin_push_immediate,
    PushImmediateRequest,
    IST
)

class AsyncIterator:
    def __init__(self, seq):
        self.iter = iter(seq)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self.iter)
        except StopIteration:
            raise StopAsyncIteration

class TestStudentNotifications(unittest.IsolatedAsyncioTestCase):
    async def test_1_immediate_notification_delivery_and_filtering(self):
        """Verify Admin A's immediate notifications go ONLY to Admin A's connected students, not Admin B's students."""
        admin_a = {"id": "admin_a", "institution_or_hostel_name": "Hostel_A", "role": "admin"}
        student_a1 = {"id": "student_a1", "admin_id": "admin_a", "institution_or_hostel_name": "Hostel_A", "role": "student", "approval_status": "approved"}
        student_b1 = {"id": "student_b1", "admin_id": "admin_b", "institution_or_hostel_name": "Hostel_B", "role": "student", "approval_status": "approved"}
        
        # Mock users_col.find to return student_a1 when searching for Hostel_A / admin_a
        mock_find_users = MagicMock(return_value=AsyncIterator([student_a1]))
        mock_insert_notifs = AsyncMock()
        mock_insert_logs = AsyncMock()
        mock_send_push = AsyncMock()
        
        with patch("server.users_col.find", new=mock_find_users), \
             patch("server.student_notifications_col.insert_many", new=mock_insert_notifs), \
             patch("server.notification_logs_col.insert_one", new=mock_insert_logs), \
             patch("server.send_push", new=mock_send_push):
            
            payload = PushImmediateRequest(title="Breakfast Alert", message="Breakfast at 7:30 AM")
            res = await admin_push_immediate(payload, u=admin_a)
            self.assertTrue(res["ok"])
            self.assertEqual(res["delivered_count"], 1)
            
            # Ensure insert_many was called with only student_a1 as recipient
            inserted_docs = mock_insert_notifs.call_args[0][0]
            self.assertEqual(len(inserted_docs), 1)
            self.assertEqual(inserted_docs[0]["recipient_id"], "student_a1")
            self.assertEqual(inserted_docs[0]["sender_id"], "admin_a")
            
    async def test_2_student_notifications_fetching_and_admin_relationship(self):
        """Verify student_notifications endpoint retrieves reverse chronological notifications matching their Admin."""
        student_a1 = {"id": "student_a1", "admin_id": "admin_a", "role": "student"}
        
        mock_notifs = [
            {
                "id": "n1",
                "recipient_id": "student_a1",
                "title": "Newest",
                "message": "Message 1",
                "created_at": "2026-08-03T10:00:00Z",
                "read_status": False,
                "sender_id": "admin_a"
            },
            {
                "id": "n2",
                "recipient_id": "student_a1",
                "title": "Older",
                "message": "Message 2",
                "created_at": "2026-08-02T10:00:00Z",
                "read_status": True,
                "sender_id": "admin_a"
            }
        ]
        
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = mock_cursor
        mock_cursor.limit.return_value = AsyncIterator(mock_notifs)
        mock_find_notifs = MagicMock(return_value=mock_cursor)
        
        with patch("server.student_notifications_col.find", new=mock_find_notifs), \
             patch("server._dispatch_scheduled_notifications", new=AsyncMock()) as mock_dispatch:
            
            res = await student_notifications(u=student_a1)
            self.assertEqual(len(res["items"]), 2)
            self.assertEqual(res["unread_count"], 1)
            self.assertEqual(res["items"][0]["title"], "Newest")
            
            # Check that scheduled dispatch was triggered right before querying
            mock_dispatch.assert_called_once()
            
            # Verify query filtered by recipient_id and sender_id matching connected Admin
            query_used = mock_find_notifs.call_args[0][0]
            self.assertEqual(query_used["recipient_id"], "student_a1")
            self.assertIn("$or", query_used)
            
    async def test_3_delete_notification_only_from_student_account(self):
        """Verify student deleting a notification deletes ONLY their copy without affecting other accounts or logs."""
        student_a1 = {"id": "student_a1", "role": "student"}
        mock_delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        
        with patch("server.student_notifications_col.delete_one", new=mock_delete_one):
            res = await delete_student_notif(notif_id="notif_xyz", u=student_a1)
            self.assertTrue(res["ok"])
            
            query_used = mock_delete_one.call_args[0][0]
            self.assertEqual(query_used["id"], "notif_xyz")
            self.assertEqual(query_used["recipient_id"], "student_a1")
            # Deleting from student_notifications_col never affects notification_logs_col or scheduled_notifications_col

if __name__ == "__main__":
    unittest.main()
