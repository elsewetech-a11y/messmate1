"""
Multi-Database Architecture & Router for MessMate
=================================================
Manages multiple MongoDB database instances and provides deterministic tenant isolation:
- ONE ADMIN / HOSTEL = ONE ASSIGNED DATABASE
- All data belonging to that Admin (students, food plans, menus, notifications, subscriptions)
  stays in that Admin's assigned database.
- Central Registry maintains routing maps, pre-auth index, and database health monitoring.
- Dynamic Tenant Collection Proxies enable seamless transparent routing for all existing business logic.
- Automated Load-Balancing distributes new Admins across healthy configured databases.
"""

import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
import contextvars
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from pydantic import BaseModel

logger = logging.getLogger("messmate.db_router")

# Context variable tracking current request's active tenant database key (e.g. "db1", "db2")
current_db_key_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("current_db_key_ctx", default="db1")
current_hostel_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("current_hostel_ctx", default=None)


class DatabaseConfig(BaseModel):
    key: str
    name: str
    uri: str
    db_name: str


class TenantCollectionProxy:
    """
    Transparent proxy around AsyncIOMotorCollection that dynamically routes
    all database operations to the active request's assigned tenant database.
    """
    def __init__(self, collection_name: str, router: "MultiDatabaseManager"):
        self._collection_name = collection_name
        self._router = router

    def _get_target_collection(self) -> AsyncIOMotorCollection:
        db_key = current_db_key_ctx.get("db1")
        database = self._router.get_database(db_key)
        return database[self._collection_name]

    def for_db(self, db_key: str) -> AsyncIOMotorCollection:
        """Explicitly target a specific database collection (e.g. for background workers)."""
        database = self._router.get_database(db_key)
        return database[self._collection_name]

    def __getattr__(self, name: str) -> Any:
        col = self._get_target_collection()
        return getattr(col, name)

    # Explicitly proxy standard async Motor methods
    async def find_one(self, *args, **kwargs):
        return await self._get_target_collection().find_one(*args, **kwargs)

    def find(self, *args, **kwargs):
        return self._get_target_collection().find(*args, **kwargs)

    async def insert_one(self, *args, **kwargs):
        return await self._get_target_collection().insert_one(*args, **kwargs)

    async def insert_many(self, *args, **kwargs):
        return await self._get_target_collection().insert_many(*args, **kwargs)

    async def update_one(self, *args, **kwargs):
        return await self._get_target_collection().update_one(*args, **kwargs)

    async def update_many(self, *args, **kwargs):
        return await self._get_target_collection().update_many(*args, **kwargs)

    async def replace_one(self, *args, **kwargs):
        return await self._get_target_collection().replace_one(*args, **kwargs)

    async def delete_one(self, *args, **kwargs):
        return await self._get_target_collection().delete_one(*args, **kwargs)

    async def delete_many(self, *args, **kwargs):
        return await self._get_target_collection().delete_many(*args, **kwargs)

    async def count_documents(self, *args, **kwargs):
        return await self._get_target_collection().count_documents(*args, **kwargs)

    async def estimated_document_count(self, *args, **kwargs):
        return await self._get_target_collection().estimated_document_count(*args, **kwargs)

    def aggregate(self, *args, **kwargs):
        return self._get_target_collection().aggregate(*args, **kwargs)

    async def distinct(self, *args, **kwargs):
        return await self._get_target_collection().distinct(*args, **kwargs)

    async def create_index(self, *args, **kwargs):
        return await self._get_target_collection().create_index(*args, **kwargs)

    async def create_indexes(self, *args, **kwargs):
        return await self._get_target_collection().create_indexes(*args, **kwargs)

    async def drop_index(self, *args, **kwargs):
        return await self._get_target_collection().drop_index(*args, **kwargs)

    async def drop_indexes(self, *args, **kwargs):
        return await self._get_target_collection().drop_indexes(*args, **kwargs)


import certifi


def create_motor_client(uri: str) -> AsyncIOMotorClient:
    """Creates an AsyncIOMotorClient with TLS certifi certificates and timeout configurations."""
    kwargs: Dict[str, Any] = {"serverSelectionTimeoutMS": 5000}
    if "mongodb+srv" in uri or "mongodb.net" in uri:
        try:
            kwargs["tlsCAFile"] = certifi.where()
            kwargs["tlsAllowInvalidCertificates"] = True
        except Exception:
            pass
    return AsyncIOMotorClient(uri, **kwargs)


class MultiDatabaseManager:
    """
    Central Multi-Database Manager orchestrating all MongoDB database connections,
    Central Registry routing, and load-balanced tenant distribution.
    """
    def __init__(self):
        self._clients: Dict[str, AsyncIOMotorClient] = {}
        self._databases: Dict[str, AsyncIOMotorDatabase] = {}
        self._configs: Dict[str, DatabaseConfig] = {}
        self._initialized = False

        # In-memory routing cache for maximum performance: hostel_name -> db_key
        self._hostel_db_cache: Dict[str, str] = {}
        # email -> (hostel_name, db_key, role)
        self._auth_cache: Dict[str, Dict[str, str]] = {}

    def load_configurations(self):
        """Discovers configured application databases from environment variables."""
        if self._configs:
            return
        primary_mongo_url = os.getenv("MONGO_URL", "mongodb://127.0.0.1:27017")
        primary_db_name = os.getenv("DB_NAME", os.getenv("DATABASE_1_NAME", "MessMate"))

        # Database 1 (Primary / Default)
        db1_uri = os.getenv("DATABASE_1_URI", primary_mongo_url)
        db1_name = os.getenv("DATABASE_1_NAME", primary_db_name)

        self._configs["db1"] = DatabaseConfig(
            key="db1",
            name="Primary Application Database",
            uri=db1_uri,
            db_name=db1_name,
        )

        # Database 2 (Secondary)
        if os.getenv("DATABASE_2_URI"):
            db2_uri = os.getenv("DATABASE_2_URI")
            db2_name = os.getenv("DATABASE_2_NAME", f"{primary_db_name}_db2")
            self._configs["db2"] = DatabaseConfig(
                key="db2",
                name="Secondary Application Database",
                uri=db2_uri,
                db_name=db2_name,
            )

        # Database 3 (Tertiary)
        if os.getenv("DATABASE_3_URI"):
            db3_uri = os.getenv("DATABASE_3_URI")
            db3_name = os.getenv("DATABASE_3_NAME", f"{primary_db_name}_db3")
            self._configs["db3"] = DatabaseConfig(
                key="db3",
                name="Tertiary Application Database",
                uri=db3_uri,
                db_name=db3_name,
            )

        # Optional additional databases DATABASE_N_URI
        for i in range(4, 21):
            uri_key = f"DATABASE_{i}_URI"
            name_key = f"DATABASE_{i}_NAME"
            if os.getenv(uri_key):
                uri = os.getenv(uri_key)
                name = os.getenv(name_key, f"{primary_db_name}_db{i}")
                self._configs[f"db{i}"] = DatabaseConfig(
                    key=f"db{i}",
                    name=f"Database Cluster {i}",
                    uri=uri,
                    db_name=name,
                )

    async def initialize(self):
        """Connects to all configured database instances and initializes Central Registry."""
        self.load_configurations()

        for key, cfg in self._configs.items():
            try:
                client = self._clients.get(key) or create_motor_client(cfg.uri)
                self._clients[key] = client
                
                target_name = cfg.db_name
                try:
                    dbs = await client.list_database_names()
                    for d in dbs:
                        if d.lower() == cfg.db_name.lower():
                            target_name = d
                            break
                except Exception:
                    pass
                
                self._databases[key] = client[target_name]
                logger.info(f"Connected to database '{key}' ({cfg.name}) at {target_name}")
            except Exception as e:
                logger.warning(f"Connecting to database '{key}' notice: {e}")

        self._initialized = True

        # Initialize Central Registry indexes and perform safe backward-compatible sync
        try:
            await self._init_central_registry()
            await self.sync_existing_data()
        except Exception as e:
            logger.warning(f"Central registry sync notice: {e}")

    @property
    def registry_db(self) -> AsyncIOMotorDatabase:
        """Central Registry is maintained on primary database (db1)."""
        return self.get_database("db1")

    @property
    def admin_registry_col(self) -> AsyncIOMotorCollection:
        return self.registry_db["_central_admin_registry"]

    @property
    def database_registry_col(self) -> AsyncIOMotorCollection:
        return self.registry_db["_central_database_registry"]

    @property
    def auth_registry_col(self) -> AsyncIOMotorCollection:
        return self.registry_db["_central_auth_registry"]

    async def _init_central_registry(self):
        """Ensures unique indexes on Central Registry collections."""
        try:
            await self.admin_registry_col.create_index("institution_or_hostel_name", unique=True)
            await self.admin_registry_col.create_index("admin_id")
            await self.admin_registry_col.create_index("admin_email")

            await self.database_registry_col.create_index("db_key", unique=True)

            await self.auth_registry_col.create_index("email", unique=True)
            await self.auth_registry_col.create_index("institution_or_hostel_name")
        except Exception as e:
            logger.warning(f"Notice creating registry indexes: {e}")

    def get_database(self, db_key: Optional[str] = None) -> AsyncIOMotorDatabase:
        """Returns the AsyncIOMotorDatabase instance for the given key (default: db1)."""
        self.load_configurations()
        target_key = db_key or current_db_key_ctx.get("db1")
        if target_key not in self._databases and target_key in self._configs:
            try:
                cfg = self._configs[target_key]
                client = create_motor_client(cfg.uri)
                self._clients[target_key] = client
                self._databases[target_key] = client[cfg.db_name]
            except Exception as e:
                logger.warning(f"On-demand client creation for '{target_key}': {e}")

        if target_key in self._databases:
            return self._databases[target_key]
        if "db1" in self._databases:
            return self._databases["db1"]
        if self._configs.get("db1"):
            cfg = self._configs["db1"]
            client = create_motor_client(cfg.uri)
            self._clients["db1"] = client
            self._databases["db1"] = client[cfg.db_name]
            return self._databases["db1"]
        raise RuntimeError(f"Database connection '{target_key}' not available.")

    def get_all_databases(self) -> Dict[str, AsyncIOMotorDatabase]:
        """Returns map of all active databases."""
        self.load_configurations()
        for key, cfg in self._configs.items():
            if key not in self._databases:
                try:
                    client = AsyncIOMotorClient(cfg.uri, serverSelectionTimeoutMS=3000)
                    self._clients[key] = client
                    self._databases[key] = client[cfg.db_name]
                except Exception:
                    pass
        return self._databases

    async def get_assigned_db_key_for_hostel(self, hostel_name: Optional[str]) -> str:
        """
        Determines the assigned database key for a given institution/hostel name.
        Uses in-memory cache with fallback to Central Registry.
        """
        if not hostel_name:
            return "db1"

        clean_hostel = hostel_name.strip()
        if clean_hostel in self._hostel_db_cache:
            return self._hostel_db_cache[clean_hostel]

        # Query central registry
        doc = await self.admin_registry_col.find_one({"institution_or_hostel_name": clean_hostel})
        if doc and doc.get("assigned_db_key"):
            db_key = doc["assigned_db_key"]
            self._hostel_db_cache[clean_hostel] = db_key
            return db_key

        # If not found in central registry, check if hostel exists in primary DB (backward compatibility)
        self._hostel_db_cache[clean_hostel] = "db1"
        return "db1"

    async def get_assigned_db_key_for_email(self, email: Optional[str]) -> Optional[str]:
        """Looks up the assigned database key for an email address."""
        if not email:
            return None

        clean_email = email.strip().lower()
        if clean_email in self._auth_cache:
            return self._auth_cache[clean_email].get("db_key")

        doc = await self.auth_registry_col.find_one({"email": clean_email})
        if doc and doc.get("assigned_db_key"):
            self._auth_cache[clean_email] = {
                "hostel_name": doc.get("institution_or_hostel_name", ""),
                "db_key": doc["assigned_db_key"],
                "role": doc.get("role", ""),
            }
            return doc["assigned_db_key"]

        return None

    async def check_database_health(self, db_key: str) -> bool:
        """Pings a specific database to check availability."""
        try:
            client = self._clients.get(db_key)
            if not client:
                return False
            await client.admin.command("ping")
            return True
        except Exception:
            return False

    async def get_available_database_for_new_admin(self) -> str:
        """
        Selects the best available database for a new Admin assignment.
        Uses load-balanced distribution across all healthy configured databases.
        """
        # Count current admins on each database
        counts: Dict[str, int] = {}
        healthy_keys: List[str] = []

        for key in self._configs.keys():
            counts[key] = 0
            is_healthy = await self.check_database_health(key)
            if is_healthy:
                healthy_keys.append(key)

            # Record health in registry
            await self.database_registry_col.update_one(
                {"db_key": key},
                {"$set": {
                    "db_key": key,
                    "name": self._configs[key].name,
                    "health_status": "OK" if is_healthy else "UNAVAILABLE",
                    "last_health_check": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True
            )

        cursor = self.admin_registry_col.find({"status": "ACTIVE"})
        async for doc in cursor:
            k = doc.get("assigned_db_key", "db1")
            counts[k] = counts.get(k, 0) + 1

        if healthy_keys:
            # Pick healthy database with the fewest current assigned admins
            chosen_key = min(healthy_keys, key=lambda k: counts.get(k, 0))
            return chosen_key

        return "db1"

    async def assign_database_for_new_admin(
        self,
        institution_or_hostel_name: str,
        admin_id: str,
        admin_email: str,
        forced_db_key: Optional[str] = None
    ) -> str:
        """
        Assigns a new Admin and Institution to a MongoDB database, recording the mapping
        in the Central Registry.
        """
        clean_hostel = institution_or_hostel_name.strip()
        clean_email = admin_email.strip().lower()

        # Check if already registered
        existing = await self.admin_registry_col.find_one({"institution_or_hostel_name": clean_hostel})
        if existing and existing.get("assigned_db_key"):
            db_key = existing["assigned_db_key"]
            self._hostel_db_cache[clean_hostel] = db_key
            return db_key

        assigned_key = forced_db_key or await self.get_available_database_for_new_admin()

        registry_record = {
            "institution_or_hostel_name": clean_hostel,
            "admin_id": str(admin_id),
            "admin_email": clean_email,
            "assigned_db_key": assigned_key,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        await self.admin_registry_col.update_one(
            {"institution_or_hostel_name": clean_hostel},
            {"$set": registry_record},
            upsert=True
        )

        # Record in central auth registry
        await self.register_user_in_central_auth(
            email=clean_email,
            role="admin",
            institution_or_hostel_name=clean_hostel,
            assigned_db_key=assigned_key
        )

        self._hostel_db_cache[clean_hostel] = assigned_key
        logger.info(f"Assigned new Admin/Hostel '{clean_hostel}' -> Database '{assigned_key}'")
        return assigned_key

    async def register_user_in_central_auth(
        self,
        email: str,
        role: str,
        institution_or_hostel_name: str,
        assigned_db_key: str
    ):
        """Stores user pointer in central auth registry for zero-latency login resolution."""
        clean_email = email.strip().lower()
        clean_hostel = institution_or_hostel_name.strip()

        record = {
            "email": clean_email,
            "role": role,
            "institution_or_hostel_name": clean_hostel,
            "assigned_db_key": assigned_db_key,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        await self.auth_registry_col.update_one(
            {"email": clean_email},
            {"$set": record},
            upsert=True
        )

        self._auth_cache[clean_email] = {
            "hostel_name": clean_hostel,
            "db_key": assigned_db_key,
            "role": role
        }

    async def sync_existing_data(self):
        """
        Safe backward-compatibility scan: Ensures all existing admins, students, and hostels
        present in DB1 are registered in the Central Registry under 'db1'.
        """
        try:
            db1 = self.get_database("db1")
            users_col = db1["users"]

            # Register all admins in DB1
            cursor = users_col.find({"role": "admin"})
            async for u in cursor:
                hostel = u.get("institution_or_hostel_name") or u.get("hostel_name")
                email = u.get("email")
                admin_id = str(u.get("id") or u.get("_id"))
                if hostel and email:
                    await self.assign_database_for_new_admin(
                        institution_or_hostel_name=hostel,
                        admin_id=admin_id,
                        admin_email=email,
                        forced_db_key="db1"
                    )

            # Register all students in DB1
            student_cursor = users_col.find({"role": "student"})
            async for s in student_cursor:
                hostel = s.get("institution_or_hostel_name") or s.get("hostel_name")
                email = s.get("email")
                if email and hostel:
                    await self.register_user_in_central_auth(
                        email=email,
                        role="student",
                        institution_or_hostel_name=hostel,
                        assigned_db_key="db1"
                    )

            logger.info("Central Registry backward-compatibility sync complete.")
        except Exception as e:
            logger.warn(f"Notice during central registry sync: {e}")

    def create_collection_proxy(self, collection_name: str) -> TenantCollectionProxy:
        """Factory for creating a dynamic tenant collection proxy."""
        return TenantCollectionProxy(collection_name, self)


# Singleton instance of the MultiDatabaseManager
db_manager = MultiDatabaseManager()
