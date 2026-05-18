"""NeuralMint Backend - FastAPI server for AI mining platform."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, chat, miners, tokens, api_keys, openai_compat, usage
from ws import miner_ws
from services.miner_manager import miner_manager
from db.database import init_db
import config


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB + launch task dispatcher
    init_db()
    await miner_manager.start_dispatcher()
    print(f"[NeuralMint] Backend started on {config.HOST}:{config.PORT}")
    print(f"[NeuralMint] RPC: {config.RPC_URL}")
    print(f"[NeuralMint] Fallback Ollama: {'enabled' if config.FALLBACK_ENABLED else 'disabled'}")
    yield
    # Shutdown
    print("[NeuralMint] Shutting down...")


app = FastAPI(
    title="NeuralMint API",
    description="Decentralized AI compute platform with token mining",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTP routers
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(miners.router)
app.include_router(tokens.router)
app.include_router(api_keys.router)
app.include_router(usage.router)

# OpenAI-compatible API (the main product)
app.include_router(openai_compat.router)

# WebSocket router
app.include_router(miner_ws.router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "active_miners": miner_manager.active_count,
        "fallback_enabled": config.FALLBACK_ENABLED,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
