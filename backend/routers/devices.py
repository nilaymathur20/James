from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from pathlib import Path
import os
import secrets
import time
from threading import Lock

from backend.services.trust_store import TrustStore, TrustedDevice
from backend.services.auth import get_or_create_user_token, hash_ip, get_client_ip

router = APIRouter()

# Dependency to get the TrustStore instance
def get_trust_store():
    # Use the same DB path as the RAG index for simplicity, or a separate one
    db_path = Path(os.getenv("RAG_DB_PATH", "data/rag_index.db"))
    # In a real production app, we would use a singleton or app state
    return TrustStore(db_path)

# In-memory PIN store: {pin: (device_id, public_key, nickname, address, expires_at)}
# PINs are short-lived (5 minutes) and single-use.
_pin_store: dict[str, tuple[str, str, str, str, float]] = {}
_pin_lock = Lock()
PIN_TTL_SECONDS = 300  # 5 minutes

class DevicePairRequest(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=100)
    public_key: str = Field(..., min_length=1, max_length=2000)
    nickname: str = Field(..., min_length=1, max_length=100)
    pin: str = Field(..., min_length=1, max_length=100)
    address: str = Field(default="", max_length=500)
    primary_ip_hash: str = Field(default="", max_length=100)

class DeviceResponse(BaseModel):
    device_id: str
    public_key: str
    nickname: str
    last_seen: str
    revoked: bool
    primary_ip_hash: str = ""

class LinkedIPResponse(BaseModel):
    ip_hash: str
    device_id: str
    nickname: str
    added_at: str

class PairChallengeResponse(BaseModel):
    pin: str
    expires_in: int

@router.post("/pair/challenge", response_model=PairChallengeResponse)
async def create_pair_challenge():
    """Generate a short-lived PIN for device pairing.

    The client displays this PIN to the user, who enters it on the target
    device. The PIN is single-use and expires after 5 minutes.
    """
    pin = secrets.token_hex(4)  # 8 hex chars
    expires_at = time.monotonic() + PIN_TTL_SECONDS
    # Store with empty device info — filled in when /pair is called
    with _pin_lock:
        _pin_store[pin] = ("", "", "", "", expires_at)
    return PairChallengeResponse(pin=pin, expires_in=PIN_TTL_SECONDS)

@router.post("/pair", response_model=DeviceResponse)
async def pair_device(request: DevicePairRequest, store: TrustStore = Depends(get_trust_store)):
    """Pair a new device after PIN verification.

    The PIN must have been obtained from /pair/challenge and the user must
    have entered it on the target device. The PIN is consumed on use.
    """
    with _pin_lock:
        entry = _pin_store.get(request.pin)
        if entry is None:
            raise HTTPException(status_code=401, detail="Invalid or expired PIN")
        _, _, _, _, expires_at = entry
        if time.monotonic() > expires_at:
            _pin_store.pop(request.pin, None)
            raise HTTPException(status_code=401, detail="PIN has expired")
        # Consume the PIN (single-use)
        _pin_store.pop(request.pin, None)

    store.add_device(request.device_id, request.public_key, request.nickname, request.address, request.primary_ip_hash)
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


@router.get("/me")
async def get_current_device(request: Request, store: TrustStore = Depends(get_trust_store)):
    """Get the current user's device info based on IP hash."""
    token, hashed_ip = get_or_create_user_token(request)
    client_ip = get_client_ip(request)

    device = store.get_device_by_ip(hashed_ip)
    if device:
        return {
            "device_id": device.device_id,
            "nickname": device.nickname,
            "primary_ip_hash": device.primary_ip_hash,
            "linked_ips": [
                {"ip_hash": lip.ip_hash, "added_at": lip.added_at}
                for lip in store.list_linked_ips(device.device_id)
            ],
            "hashed_ip": hashed_ip,
            "client_ip": client_ip,
            "is_linked": True,
        }

    return {
        "device_id": None,
        "nickname": None,
        "hashed_ip": hashed_ip,
        "client_ip": client_ip,
        "is_linked": False,
    }


class LinkIPRequest(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=100)
    pin: str = Field(..., min_length=1, max_length=100)


@router.post("/link-ip")
async def link_ip_to_device(
    payload: LinkIPRequest,
    request: Request,
    store: TrustStore = Depends(get_trust_store)
):
    """Link the current IP hash to an existing device using a PIN."""
    # Verify the PIN is valid and was generated for this device linking
    with _pin_lock:
        entry = _pin_store.get(payload.pin)
        if entry is None:
            raise HTTPException(status_code=401, detail="Invalid or expired PIN")
        stored_device_id, _, _, _, expires_at = entry
        if time.monotonic() > expires_at:
            _pin_store.pop(payload.pin, None)
            raise HTTPException(status_code=401, detail="PIN has expired")
        if stored_device_id != payload.device_id:
            raise HTTPException(status_code=401, detail="PIN not valid for this device")
        _pin_store.pop(payload.pin, None)

    # Get current user's IP hash
    _, hashed_ip = get_or_create_user_token(request)

    # Link the IP to the device
    success = store.link_ip(payload.device_id, hashed_ip, "")
    if not success:
        raise HTTPException(status_code=404, detail="Device not found or revoked")

    return {"status": "success", "message": f"IP linked to device {payload.device_id}"}


@router.get("/devices/{device_id}/links")
async def get_device_links(device_id: str, store: TrustStore = Depends(get_trust_store)):
    """Get all linked IPs for a device."""
    links = store.list_linked_ips(device_id)
    return {"device_id": device_id, "linked_ips": [
        {"ip_hash": lip.ip_hash, "nickname": lip.nickname, "added_at": lip.added_at}
        for lip in links
    ]}
