"""Authentication endpoints for JWT token management."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..services.auth import get_or_create_user_token, get_client_ip, hash_ip

router = APIRouter()


class AuthResponse(BaseModel):
    token: str
    hashed_ip: str
    client_ip: str


@router.post("/auth/token", response_model=AuthResponse)
async def get_token(request: Request):
    """Get or create a JWT token for the current client.

    Returns a token based on the client's IP address (hashed for privacy).
    If a valid token is provided in the Authorization header, it is returned.
    Otherwise, a new token is generated based on the client's current IP.
    """
    token, hashed_ip = get_or_create_user_token(request)
    client_ip = get_client_ip(request)

    return AuthResponse(
        token=token,
        hashed_ip=hashed_ip,
        client_ip=client_ip
    )


@router.get("/auth/verify")
async def verify_token(request: Request):
    """Verify the current token and return user info."""
    token, hashed_ip = get_or_create_user_token(request)
    client_ip = get_client_ip(request)

    return {
        "valid": True,
        "hashed_ip": hashed_ip,
        "client_ip": client_ip
    }
