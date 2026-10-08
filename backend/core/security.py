import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from jwt import PyJWTError

from core.config import ACCESS_TOKEN_EXPIRE_HOURS, ALGORITHM, SECRET_KEY


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


PASSWORD_MIN_LENGTH = 8


def password_problem(password: str | None, email: str | None = None) -> str | None:
    """Why a new password is refused, or None. Mirrored by `passwordChecks` in lib/password.js."""
    password = password or ""
    if len(password) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters long"
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return "Password must contain at least one letter and one digit"
    if email and password.strip().lower() == email.strip().lower():
        return "Password must be different from your email"
    return None


def check_new_password(password: str | None, email: str | None = None) -> None:
    problem = password_problem(password, email)
    if problem:
        raise HTTPException(status_code=400, detail=problem)


def hash_reset_token(token: str) -> str:
    # SHA-256, not bcrypt: the token is random enough, and the digest stays searchable.
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(data: dict, expires_minutes: int = ACCESS_TOKEN_EXPIRE_HOURS * 60) -> str:
    payload = {**data, "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except PyJWTError:
        return None


async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    payload = verify_token(auth_header.removeprefix("Bearer "))
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return payload


async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")
    return current_user


def get_account_id(current_user: dict) -> int:
    # Absent from a token issued before an organization is chosen.
    account_id = current_user.get("account_id")
    if not isinstance(account_id, int):
        raise HTTPException(status_code=403, detail="No organization selected")
    return account_id
