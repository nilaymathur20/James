"""JWT Authentication using hashed client IP addresses.

This module provides JWT token generation and verification based on client IP hashes,
allowing chat session persistence and P2P device linking across multiple IP addresses.
"""

from __future__ import annotations

import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import HTTPException, Request

# Secret key for JWT signing - should be set via environment variable
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 365  # Tokens valid for 1 year


def hash_ip(ip_address: str) -> str:
    """Hash an IP address using SHA-256.

    Args:
        ip_address: The client IP address to hash

    Returns:
        A hexadecimal string representation of the hashed IP
    """
    return hashlib.sha256(ip_address.encode()).hexdigest()


def create_token(hashed_ip: str) -> str:
    """Generate a JWT token for a hashed IP address.

    Args:
        hashed_ip: The hashed client IP address

    Returns:
        A signed JWT token string
    """
    payload = {
        "sub": hashed_ip,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Optional[str]:
    """Verify a JWT token and extract the hashed IP.

    Args:
        token: The JWT token to verify

    Returns:
        The hashed IP from the token payload, or None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_client_ip(request: Request) -> str:
    """Extract the client IP address from the request.

    Handles X-Forwarded-For and X-Real-IP headers for proxied requests.

    Args:
        request: The FastAPI request object

    Returns:
        The client IP address as a string
    """
    # Check for proxy headers first
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can be a comma-separated list; take the first IP
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fall back to direct client host
    return request.client.host if request.client else "127.0.0.1"


def get_or_create_user_token(request: Request) -> tuple[str, str]:
    """Get existing token from Authorization header or create a new one.

    Args:
        request: The FastAPI request object

    Returns:
        A tuple of (token, hashed_ip)
    """
    # Try to get existing token from Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]  # Remove "Bearer " prefix
        hashed_ip = verify_token(token)
        if hashed_ip:
            return token, hashed_ip

    # Create new token based on client IP
    client_ip = get_client_ip(request)
    hashed_ip = hash_ip(client_ip)
    token = create_token(hashed_ip)
    return token, hashed_ip


def require_auth(request: Request) -> str:
    """Dependency that requires valid authentication.

    Args:
        request: The FastAPI request object

    Returns:
        The hashed IP from the verified token

    Raises:
        HTTPException: If token is missing or invalid
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header[7:]
    hashed_ip = verify_token(token)
    if not hashed_ip:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return hashed_ip
