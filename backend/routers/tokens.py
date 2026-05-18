"""Token balance and stats endpoints."""

from fastapi import APIRouter
from models.schemas import TokenStats
from services.chain import get_token_balance, get_token_stats
from services.miner_manager import miner_manager

router = APIRouter(prefix="/api/tokens", tags=["tokens"])


@router.get("/balance/{address}")
async def balance(address: str):
    """Get NMT balance for a wallet address."""
    raw = await get_token_balance(address)
    return {
        "address": address,
        "balance_raw": str(raw),
        "balance": str(raw / 10**18),
    }


@router.get("/stats", response_model=TokenStats)
async def stats():
    """Get overall token and mining statistics."""
    chain_stats = await get_token_stats()
    return TokenStats(
        total_supply=chain_stats["total_supply"],
        max_supply=chain_stats["max_supply"],
        circulating=chain_stats["total_supply"],  # simplified
        total_mined=chain_stats["total_supply"],
        current_reward=chain_stats["current_reward"],
        current_epoch=chain_stats["current_epoch"],
        claims_until_halving=chain_stats["claims_until_halving"],
        active_miners=miner_manager.active_count,
        pow_difficulty=chain_stats["pow_difficulty"],
    )
