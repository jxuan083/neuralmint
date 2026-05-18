"""Miner registration and status endpoints."""

from fastapi import APIRouter, HTTPException
from models.schemas import MinerInfo, MinerStatus
from services.miner_manager import miner_manager

router = APIRouter(prefix="/api/miners", tags=["miners"])


@router.get("", response_model=list[MinerInfo])
async def list_miners():
    """List all active miners."""
    return miner_manager.active_miners


@router.get("/count")
async def miner_count():
    return {"active": miner_manager.active_count}
