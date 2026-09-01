"""Unit test verifying that student blocking and unblocking succeed without 500 error."""
import asyncio
import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

import server

@pytest.mark.asyncio
async def test_student_block_and_unblock_flow():
    """Verify that an admin can block a student and then unblock them without 500 NameError."""
    admin_id = str(uuid.uuid4())
    student_id = str(uuid.uuid4())
    hostel = "Test Hostels"
    
    admin_user = {
        "id": admin_id,
        "role": "admin",
        "institution_or_hostel_name": hostel,
        "subscription": {
            "status": "ACTIVE",
            "student_limit": 100
        }
    }
    
    # 1. Test Block
    with patch.object(server.users_col, "update_one", new_callable=AsyncMock) as mock_update, \
         patch.object(server.users_col, "find_one", new_callable=AsyncMock) as mock_find_one, \
         patch.object(server, "rotate_session", new_callable=AsyncMock):
        
        mock_update.return_value = MagicMock(matched_count=1, modified_count=1)
        res_block = await server.admin_block(student_id, admin_user)
        assert res_block["ok"] is True
        print("[SUCCESS] Student block succeeded!")

    # 2. Test Unblock via admin_unblock (which calls admin_approve)
    with patch.object(server.pending_requests_col, "find_one", new_callable=AsyncMock) as mock_pend_find, \
         patch.object(server.users_col, "update_one", new_callable=AsyncMock) as mock_update, \
         patch.object(server, "get_subscription_status", new_callable=AsyncMock) as mock_sub_status:
        
        mock_sub_status.return_value = {
            "status": "ACTIVE",
            "student_limit": 100,
            "registered_students": 10,
            "is_trial": False
        }
        mock_pend_find.return_value = None # Not in pending, already in users_col (blocked)
        mock_update.return_value = MagicMock(matched_count=1, modified_count=1)
        
        res_unblock = await server.admin_unblock(student_id, admin_user)
        assert res_unblock["ok"] is True
        assert res_unblock["status"] == "approved"
        print("[SUCCESS] Student unblock succeeded without any 500 error!")

if __name__ == "__main__":
    asyncio.run(test_student_block_and_unblock_flow())
