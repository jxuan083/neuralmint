"""SQLAlchemy ORM models."""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text
from db.database import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(64), unique=True, nullable=False, index=True)  # nmt_xxxx
    name = Column(String(100), nullable=False)  # user-given label
    wallet_address = Column(String(42), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_used_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    total_requests = Column(Integer, default=0)
    total_tokens_used = Column(Integer, default=0)  # LLM tokens (input+output)
    total_nmt_spent = Column(Float, default=0.0)  # NMT spent


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key = Column(String(64), nullable=False, index=True)
    wallet_address = Column(String(42), nullable=False)
    model = Column(String(50), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    nmt_cost = Column(Float, default=0.0)
    miner_address = Column(String(42), nullable=True)
    duration_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class TaskRecord(Base):
    __tablename__ = "task_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(36), unique=True, nullable=False, index=True)
    api_key = Column(String(64), nullable=True)
    wallet_address = Column(String(42), nullable=False)
    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    model = Column(String(50), nullable=False)
    status = Column(String(20), default="queued")  # queued/assigned/completed/failed/timeout
    miner_address = Column(String(42), nullable=True)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    nmt_cost = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
