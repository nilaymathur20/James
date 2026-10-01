from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path
import os

from backend.services.trust_store import TrustStore, TrustedDevice

router = APIRouter()

# Dependency to get the TrustStore instance
def get_trust_store():
    # Use the same DB path as the RAG index for simplicity, or a separate one
    db_path = Path(os.getenv("RAG_DB_PATH", "data/rag_index.db"))
    # In a real production app, we would use a singleton or app state
    return TrustStore(db_path)

class DevicePairRequest(BaseModel):
    device_id: str
    public_key: str
    nickname: str
    pin: str

class DeviceResponse(BaseModel):
    device_id: str
    public_key: str
    nickname: str
    last_seen: str
    revoked: bool

@router.post("/pair", response_model=DeviceResponse)
async def pair_device(request: DevicePairRequest, store: TrustStore = Depends(get_trust_store)):
    """
    Pair a new device using a PIN handshake.
    In a full implementation, the PIN would be verified against a
    temporary session created via QR code.
    """
    # PIN verification logic would go here
    store.add_device(request.device_id, request.public_key, request.nickname)
    device = store.get_device(request.device_id)
    if not device:
        raise HTTPException(status_code=500, detail="Failed to save trusted device")
    return device

@router.get("/devices", response_model=List[DeviceResponse])
async def list_devices(store: TrustStore = Depends(get_trust_store)):
    """List all trusted devices."""
    return store.list_devices()

@router.post("/revoke/{device_id}")
async def revoke_device(device_id: str, store: TrustStore = Depends(get_trust_store)):
    """Revoke trust for a specific device."""
    store.revoke_device(device_id)
    return {"status": "success", "message": f"Device {device_id} revoked"}

@router.post("/heartbeat/{device_id}")
async def device_heartbeat(device_id: str, store: TrustStore = Depends(get_trust_store)):
    """Update the last seen timestamp for a device."""
    store.update_last_seen(device_id)
    return {"status": "ok"}
