"""Usage statistics endpoints for the developer dashboard."""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from db.database import get_db
from db.models import UsageRecord, ApiKey
from routers.auth import get_address_from_token

router = APIRouter(prefix="/api/usage", tags=["usage"])


class DailyUsage(BaseModel):
    date: str
    requests: int
    tokens: int
    nmt_spent: float


class UsageSummary(BaseModel):
    total_requests: int
    total_tokens: int
    total_nmt_spent: float
    daily: list[DailyUsage]


def _get_wallet(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    address = get_address_from_token(authorization.replace("Bearer ", ""))
    if not address:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    return address


@router.get("/summary", response_model=UsageSummary)
async def usage_summary(days: int = 30, db: Session = Depends(get_db),
                        wallet: str = Depends(_get_wallet)):
    """Get usage summary for the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    records = db.query(UsageRecord).filter(
        UsageRecord.wallet_address == wallet,
        UsageRecord.created_at >= since,
    ).all()

    # Aggregate by day
    daily_map: dict[str, DailyUsage] = {}
    for r in records:
        day = r.created_at.strftime("%Y-%m-%d")
        if day not in daily_map:
            daily_map[day] = DailyUsage(date=day, requests=0, tokens=0, nmt_spent=0.0)
        daily_map[day].requests += 1
        daily_map[day].tokens += r.total_tokens
        daily_map[day].nmt_spent += r.nmt_cost

    daily = sorted(daily_map.values(), key=lambda d: d.date)

    return UsageSummary(
        total_requests=len(records),
        total_tokens=sum(r.total_tokens for r in records),
        total_nmt_spent=sum(r.nmt_cost for r in records),
        daily=daily,
    )


@router.get("/recent")
async def recent_requests(limit: int = 50, db: Session = Depends(get_db),
                          wallet: str = Depends(_get_wallet)):
    """Get recent API requests."""
    records = db.query(UsageRecord).filter(
        UsageRecord.wallet_address == wallet,
    ).order_by(UsageRecord.created_at.desc()).limit(limit).all()

    return [
        {
            "id": r.id,
            "model": r.model,
            "prompt_tokens": r.prompt_tokens,
            "completion_tokens": r.completion_tokens,
            "total_tokens": r.total_tokens,
            "nmt_cost": r.nmt_cost,
            "miner": r.miner_address,
            "duration_ms": r.duration_ms,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]
