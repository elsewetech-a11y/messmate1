from typing import Dict, Set
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps institution_or_hostel_name -> set of WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps websocket -> (user_id, role, institution)
        self.ws_metadata: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, role: str, institution: str):
        await websocket.accept()
        if institution not in self.active_connections:
            self.active_connections[institution] = set()
        self.active_connections[institution].add(websocket)
        self.ws_metadata[websocket] = {
            "user_id": user_id,
            "role": role,
            "institution": institution
        }
        print(f"[WS] Connected {user_id} ({role}) in {institution}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.ws_metadata:
            meta = self.ws_metadata[websocket]
            inst = meta["institution"]
            if inst in self.active_connections and websocket in self.active_connections[inst]:
                self.active_connections[inst].remove(websocket)
            del self.ws_metadata[websocket]
            print(f"[WS] Disconnected {meta['user_id']}")

    async def broadcast_to_institution(self, institution: str, message: dict):
        if institution in self.active_connections:
            to_remove = set()
            for ws in list(self.active_connections[institution]):
                try:
                    await ws.send_json(message)
                except Exception as e:
                    print(f"[WS] Error broadcasting to institution {institution}: {e}")
                    to_remove.add(ws)
            for ws in to_remove:
                self.disconnect(ws)

    async def broadcast_to_role(self, institution: str, role: str, message: dict):
        if institution in self.active_connections:
            to_remove = set()
            for ws in list(self.active_connections[institution]):
                meta = self.ws_metadata.get(ws)
                if meta and meta["role"] == role:
                    try:
                        await ws.send_json(message)
                    except Exception as e:
                        print(f"[WS] Error broadcasting to role {role} in {institution}: {e}")
                        to_remove.add(ws)
            for ws in to_remove:
                self.disconnect(ws)

    async def broadcast_to_user(self, user_id: str, message: dict):
        to_remove = set()
        for ws, meta in list(self.ws_metadata.items()):
            if meta["user_id"] == user_id:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    print(f"[WS] Error broadcasting to user {user_id}: {e}")
                    to_remove.add(ws)
        for ws in to_remove:
            self.disconnect(ws)

manager = ConnectionManager()
