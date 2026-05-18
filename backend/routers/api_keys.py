"""API Key management - create, list, revoke keys tied to wallet addresses."""

import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import ApiKey
from routers.auth import get_address_from_token

router = APIRouter(prefix="/api/keys", tags=["api-keys"])


class CreateKeyRequest(BaseModel):
    name: str  # e.g. "my-app", "testing"


class ApiKeyResponse(BaseModel):
    id: int
    key: str
    name: str
    created_at: str
    last_used_at: str | None
    is_active: bool
    total_requests: int
    total_tokens_used: int
    total_nmt_spent: float

    class Config:
        from_attributes = True


def _get_wallet(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    address = get_address_from_token(authorization.replace("Bearer ", ""))
    if not address:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    return address


def generate_api_key() -> str:
    """Generate a key like nmt_sk_abc123..."""
    return f"nmt_sk_{secrets.token_hex(24)}"


@router.post("", response_model=ApiKeyResponse)
async def create_key(body: CreateKeyRequest, db: Session = Depends(get_db),
                     wallet: str = Depends(_get_wallet)):
    """Create a new API key tied to the caller's wallet."""
    # Limit: max 5 keys per wallet
    count = db.query(ApiKey).filter(
        ApiKey.wallet_address == wallet,
        ApiKey.is_active == True,
    ).count()
    if count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 active keys per wallet")

    key = generate_api_key()
    db_key = ApiKey(
        key=key,
        name=body.name,
        wallet_address=wallet,
    )
    db.add(db_key)
    db.commit()
    db.refresh(db_key)

    return ApiKeyResponse(
        id=db_key.id,
        key=db_key.key,
        name=db_key.name,
        created_at=db_key.created_at.isoformat(),
        last_used_at=None,
        is_active=True,
        total_requests=0,
        total_tokens_used=0,
        total_nmt_spent=0.0,
    )


@router.get("", response_model=list[ApiKeyResponse])
async def list_keys(db: Session = Depends(get_db), wallet: str = Depends(_get_wallet)):
    """List all API keys for the caller's wallet."""
    keys = db.query(ApiKey).filter(ApiKey.wallet_address == wallet).all()
    return [
        ApiKeyResponse(
            id=k.id,
            key=f"{k.key[:10]}...{k.key[-4:]}",  # mask the key
            name=k.name,
            created_at=k.created_at.isoformat(),
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            is_active=k.is_active,
            total_requests=k.total_requests,
            total_tokens_used=k.total_tokens_used,
            total_nmt_spent=k.total_nmt_spent,
        )
        for k in keys
    ]


@router.delete("/{key_id}")
async def revoke_key(key_id: int, db: Session = Depends(get_db),
                     wallet: str = Depends(_get_wallet)):
    """Revoke an API key."""
    db_key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.wallet_address == wallet,
    ).first()
    if not db_key:
        raise HTTPException(status_code=404, detail="Key not found")

    db_key.is_active = False
    db.commit()
    return {"status": "revoked"}


def validate_api_key(api_key: str, db: Session) -> ApiKey | None:
    """Validate an API key and return the ApiKey record."""
    db_key = db.query(ApiKey).filter(
        ApiKey.key == api_key,
        ApiKey.is_active == True,
    ).first()
    if db_key:
        db_key.last_used_at = datetime.now(timezone.utc)
        db_key.total_requests += 1
        db.commit()
    return db_key
