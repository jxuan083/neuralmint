from pydantic import BaseModel
from enum import Enum
from typing import Optional


# --- Auth ---
class AuthChallenge(BaseModel):
    address: str
    message: str
    nonce: str


class AuthVerify(BaseModel):
    address: str
    signature: str
    message: str


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    address: str


# --- Chat ---
class ChatRequest(BaseModel):
    prompt: str
    model: Optional[str] = None


class ChatResponse(BaseModel):
    task_id: str
    status: str


# --- Miner ---
class MinerStatus(str, Enum):
    ONLINE = "online"
    BUSY = "busy"
    OFFLINE = "offline"


class MinerInfo(BaseModel):
    address: str
    gpu_name: Optional[str] = None
    gpu_memory_mb: Optional[int] = None
    model_loaded: Optional[str] = None
    status: MinerStatus = MinerStatus.ONLINE
    tasks_completed: int = 0
    tokens_earned: float = 0.0


class MinerRegister(BaseModel):
    address: str
    signature: str
    gpu_name: Optional[str] = None
    gpu_memory_mb: Optional[int] = None
    model_loaded: Optional[str] = None


# --- Task ---
class TaskStatus(str, Enum):
    QUEUED = "queued"
    ASSIGNED = "assigned"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class AITask(BaseModel):
    task_id: str
    prompt: str
    user_address: str
    miner_address: Optional[str] = None
    status: TaskStatus = TaskStatus.QUEUED
    result: Optional[str] = None


# --- PoW ---
class PoWChallenge(BaseModel):
    last_hash: str
    difficulty: str
    block_number: int


class PoWSubmission(BaseModel):
    nonce: int
    miner_address: str
    signature: str


# --- Token Stats ---
class TokenStats(BaseModel):
    total_supply: str
    max_supply: str
    circulating: str
    total_mined: str
    current_reward: str
    current_epoch: int
    claims_until_halving: int
    active_miners: int
    pow_difficulty: str
