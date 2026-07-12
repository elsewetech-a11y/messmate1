import time
from typing import Any, Optional

class CacheService:
    """
    Abstract Cache layer for MessMate.
    Currently uses an in-memory LRU-like dictionary.
    Production ready to be swapped with redis.Redis()
    """
    def __init__(self):
        self._store = {}
        
    def get(self, key: str) -> Optional[Any]:
        if key in self._store:
            value, expires_at = self._store[key]
            if expires_at and time.time() > expires_at:
                del self._store[key]
                return None
            return value
        return None

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = 300) -> None:
        expires_at = time.time() + ttl_seconds if ttl_seconds else None
        self._store[key] = (value, expires_at)
        
    def delete(self, key: str) -> None:
        if key in self._store:
            del self._store[key]
            
    def clear(self) -> None:
        self._store.clear()

# Global cache instance
cache = CacheService()
