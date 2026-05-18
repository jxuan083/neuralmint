"""SQLite database setup with SQLAlchemy."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DB_PATH = os.getenv("DATABASE_URL", "sqlite:///neuralmint.db")

engine = create_engine(DB_PATH, echo=False)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from db.models import ApiKey, UsageRecord, TaskRecord  # noqa
    Base.metadata.create_all(bind=engine)
