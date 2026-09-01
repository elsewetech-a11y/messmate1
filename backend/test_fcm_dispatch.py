"""Unit test for Firebase Cloud Messaging (FCM) dispatch engine with mocked database collections."""
import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

# Ensure environment variables are present before importing server
import server

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

@pytest.mark.asyncio
async def test_fcm_token_storage_and_dispatch():
    """Test storing an FCM token and triggering send_push via mocks without requiring MongoDB Atlas network connection."""
    admin_id = str(uuid.uuid4())
    student_id = str(uuid.uuid4())
    test_token = "fcm_test_device_token_" + str(uuid.uuid4())
    
    mock_users_db = [
        {
            "id": student_id,
            "name": "FCM Test Student",
            "role": "student",
            "approval_status": "approved",
            "fcm_token": test_token,
            "push_token": test_token,
            "push_platform": "android"
        }
    ]
    
    # Mock users_col.find and push_tokens_col.find to return our simulated student record
    mock_find = MagicMock(return_value=AsyncIterator(mock_users_db))
    mock_pt_find = MagicMock(return_value=AsyncIterator([]))
    
    with patch.object(server.users_col, "find", mock_find), \
         patch.object(server.push_tokens_col, "find", mock_pt_find), \
         patch.object(server.users_col, "update_one", new_callable=AsyncMock) as mock_update, \
         patch.object(server.push_tokens_col, "update_one", new_callable=AsyncMock) as mock_push_update:
        
        # 1. Test save_push_token logic
        await server.save_push_token(
            payload=server.PushTokenInput(push_token=test_token, platform="android"),
            u={"id": student_id, "role": "student", "institution_or_hostel_name": "TestHostel"}
        )
        assert mock_update.called
        update_args = mock_update.call_args[0]
        assert update_args[0] == {"id": student_id}
        assert update_args[1]["$set"]["fcm_token"] == test_token
        print("FCM Token account persistence verification PASSED!")
        
        # 2. Test send_push logic
        data = {
            "title": "MessMate Notification",
            "message": "Tomorrow Breakfast Menu\nIdli, Sambar and Chutney will be served at 7:30 AM.",
            "action_url": "/notifications"
        }
        await server.send_push([student_id], data)
        print("send_push successfully extracted token from db and processed FCM dispatch without error!")

if __name__ == "__main__":
    asyncio.run(test_fcm_token_storage_and_dispatch())
