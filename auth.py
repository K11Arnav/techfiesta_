"""
auth.py — JWT Authentication + RBAC for Fraud Detection Platform
─────────────────────────────────────────────────────────────────
Self-contained module. No existing code modified.

Public API:
    create_token(user_id, role) -> str
    get_current_user(token)     -> dict   (FastAPI Depends)
    require_role(*roles)        -> Depends (FastAPI Depends)
    verify_password(plain, hashed) -> bool
    hash_password(plain) -> str
    ROLE_DOMAINS                -> dict
"""

import os
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "techfiesta-secret-key-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 480  # 8 hours

# ── Password handling (TEMP: Plaintext as requested) ──────────────────────────
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """TEMP: Plain-text comparison for testing."""
    return plain_password == hashed_password

def hash_password(password: str) -> str:
    """TEMP: No hashing for now."""
    return password

# ── JWT ───────────────────────────────────────────────────────────────────────
def create_token(user_id: int, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

# ── FastAPI dependencies ──────────────────────────────────────────────────────
security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Extract and validate current user from JWT bearer token.
    Returns dict with user_id and role.
    If no token is provided, returns a guest user (for backward compatibility)."""
    if credentials is None:
        # No token → guest / backward-compatible access
        return {"user_id": None, "role": "admin"}
    return decode_token(credentials.credentials)

def get_current_role(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Extract role string from JWT."""
    user = get_current_user(credentials)
    return user["role"]

def require_role(*allowed_roles: str):
    """Dependency factory: restrict endpoint to specific roles."""
    def _check(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user['role']}' not authorized. Requires: {allowed_roles}",
            )
        return user
    return Depends(_check)

# ── RBAC Domain Mapping ──────────────────────────────────────────────────────
ROLE_DOMAINS = {
    "retail": ["retail"],
    "corporate": ["corporate"],
    "card": ["card"],
    "international": ["international"],
    "merchant": ["merchant"],
    "admin": ["retail", "corporate", "card", "international", "merchant"],
}

def get_allowed_domains(role: str) -> List[str]:
    """Return list of transaction domains a role can access."""
    return ROLE_DOMAINS.get(role, [])
