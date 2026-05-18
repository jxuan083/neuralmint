"""Wallet-based authentication via Ethereum signed messages."""

import uuid
import time
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from jose import jwt
from models.schemas import AuthChallenge, AuthVerify, AuthToken
from services.chain import verify_signature
import config

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Store pending challenges (nonce -> address)
_challenges: dict[str, dict] = {}


@router.get("/challenge/{address}", response_model=AuthChallenge)
async def get_challenge(address: str):
    """Generate a sign-in challenge for a wallet address."""
    nonce = str(uuid.uuid4())
    message = f"Sign in to NeuralMint\nAddress: {address}\nNonce: {nonce}\nTimestamp: {int(time.time())}"

    _challenges[nonce] = {
        "address": address.lower(),
        "message": message,
        "created_at": time.time(),
    }

    return AuthChallenge(address=address, message=message, nonce=nonce)


@router.post("/verify", response_model=AuthToken)
async def verify_auth(body: AuthVerify):
    """Verify a signed message and return a JWT."""
    if not verify_signature(body.address, body.message, body.signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Create JWT
    expire = datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXPIRE_HOURS)
    payload = {
        "sub": body.address.lower(),
        "exp": expire,
    }
    token = jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)

    return AuthToken(access_token=token, address=body.address)


def get_address_from_token(token: str) -> str | None:
    """Decode JWT and return the wallet address."""
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None
