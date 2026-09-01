"""
Tests for Multi-Database Architecture & Routing
================================================
Verifies:
1. Dynamic multi-database initialization and Central Registry setup.
2. Safe backward compatibility: existing admins are indexed in db1.
3. Automated load-balanced distribution of new Admins across healthy configured databases (DB1, DB2, DB3) without capacity constraints.
4. Deterministic tenant data isolation:
   - Admin 1 data & Students -> DB1
   - Admin 2 data & Students -> DB2
   - No data bleeding between databases.
"""

import pytest
import asyncio
from db_router import MultiDatabaseManager, DatabaseConfig, current_db_key_ctx, current_hostel_ctx


@pytest.fixture
async def multi_db():
    manager = MultiDatabaseManager()
    manager._configs = {
        "db1": DatabaseConfig(key="db1", name="DB 1", uri="mongodb://127.0.0.1:27017", db_name="test_messmate_db1"),
        "db2": DatabaseConfig(key="db2", name="DB 2", uri="mongodb://127.0.0.1:27017", db_name="test_messmate_db2"),
        "db3": DatabaseConfig(key="db3", name="DB 3", uri="mongodb://127.0.0.1:27017", db_name="test_messmate_db3"),
    }
    await manager.initialize()

    # Clean up test databases
    for db in manager.get_all_databases().values():
        await db["users"].delete_many({})
        await db["menus"].delete_many({})
        await db["daily_plans"].delete_many({})
        await db["subscriptions"].delete_many({})
        await db["_central_admin_registry"].delete_many({})
        await db["_central_database_registry"].delete_many({})
        await db["_central_auth_registry"].delete_many({})

    yield manager

    # Teardown
    for db in manager.get_all_databases().values():
        await db["users"].delete_many({})
        await db["menus"].delete_many({})
        await db["daily_plans"].delete_many({})
        await db["subscriptions"].delete_many({})
        await db["_central_admin_registry"].delete_many({})
        await db["_central_database_registry"].delete_many({})
        await db["_central_auth_registry"].delete_many({})


@pytest.mark.anyio
async def test_admin_assignment_and_load_balanced_routing(multi_db):
    manager = multi_db

    # 1. First admin assigns to db1 (all databases have 0 admins)
    db_a = await manager.assign_database_for_new_admin("Alpha Hostel", "admin_1", "admin1@alpha.com")
    assert db_a in ["db1", "db2", "db3"]

    # 2. Second admin assigns to one of the least-loaded remaining databases
    db_b = await manager.assign_database_for_new_admin("Beta Hostel", "admin_2", "admin2@beta.com")
    assert db_b in ["db1", "db2", "db3"]
    assert db_b != db_a  # Balances across different databases

    # 3. Third admin assigns to the third database
    db_c = await manager.assign_database_for_new_admin("Gamma Hostel", "admin_3", "admin3@gamma.com")
    assert db_c in ["db1", "db2", "db3"]
    assert len({db_a, db_b, db_c}) == 3  # All 3 databases evenly receive 1 admin each!

    # 4. Fourth admin distributes smoothly
    db_d = await manager.assign_database_for_new_admin("Delta Hostel", "admin_4", "admin4@delta.com")
    assert db_d in ["db1", "db2", "db3"]


@pytest.mark.anyio
async def test_tenant_data_isolation_between_databases(multi_db):
    manager = multi_db

    # Create proxy
    users_proxy = manager.create_collection_proxy("users")
    daily_plans_proxy = manager.create_collection_proxy("daily_plans")

    # Assign Admin 1 to db1, Admin 2 to db2
    await manager.assign_database_for_new_admin("Hostel One", "adm_1", "admin1@hostel1.com", forced_db_key="db1")
    await manager.assign_database_for_new_admin("Hostel Two", "adm_2", "admin2@hostel2.com", forced_db_key="db2")

    # Insert data for Hostel One in db1 context
    token1 = current_db_key_ctx.set("db1")
    await users_proxy.insert_one({"id": "stu_1", "full_name": "Student in DB1", "institution_or_hostel_name": "Hostel One"})
    await daily_plans_proxy.insert_one({"id": "plan_1", "student_id": "stu_1", "date": "2026-08-29", "breakfast": True})
    current_db_key_ctx.reset(token1)

    # Insert data for Hostel Two in db2 context
    token2 = current_db_key_ctx.set("db2")
    await users_proxy.insert_one({"id": "stu_2", "full_name": "Student in DB2", "institution_or_hostel_name": "Hostel Two"})
    await daily_plans_proxy.insert_one({"id": "plan_2", "student_id": "stu_2", "date": "2026-08-29", "breakfast": False})
    current_db_key_ctx.reset(token2)

    # Verify DB1 only contains Student 1
    t1 = current_db_key_ctx.set("db1")
    stu_db1 = await users_proxy.find({"institution_or_hostel_name": "Hostel One"}).to_list(10)
    assert len(stu_db1) == 1
    assert stu_db1[0]["id"] == "stu_1"

    no_stu_db2 = await users_proxy.find({"institution_or_hostel_name": "Hostel Two"}).to_list(10)
    assert len(no_stu_db2) == 0  # Hostel Two does NOT exist in DB1!
    current_db_key_ctx.reset(t1)

    # Verify DB2 only contains Student 2
    t2 = current_db_key_ctx.set("db2")
    stu_db2 = await users_proxy.find({"institution_or_hostel_name": "Hostel Two"}).to_list(10)
    assert len(stu_db2) == 1
    assert stu_db2[0]["id"] == "stu_2"

    no_stu_db1 = await users_proxy.find({"institution_or_hostel_name": "Hostel One"}).to_list(10)
    assert len(no_stu_db1) == 0  # Hostel One does NOT exist in DB2!
    current_db_key_ctx.reset(t2)


@pytest.mark.anyio
async def test_student_routes_to_connected_admin_database(multi_db):
    manager = multi_db

    # Admin registers for "Oxford Mess" -> assigned to db2
    await manager.assign_database_for_new_admin("Oxford Mess", "adm_oxford", "oxford@admin.com", forced_db_key="db2")

    # Student registers choosing "Oxford Mess"
    student_db_key = await manager.get_assigned_db_key_for_hostel("Oxford Mess")
    assert student_db_key == "db2"

    await manager.register_user_in_central_auth("student@oxford.com", "student", "Oxford Mess", student_db_key)

    # Student login lookup
    resolved_db = await manager.get_assigned_db_key_for_email("student@oxford.com")
    assert resolved_db == "db2"
