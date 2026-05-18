"""OpenAI-compatible API endpoint.

Developers can use this with the official OpenAI SDK by just changing base_url and api_key:

    from openai import OpenAI
    client = OpenAI(
        base_url="http://localhost:8000/v1",
        api_key="nmt_sk_xxxx"
    )
    response = client.chat.completions.create(
        model="llama-3.2-3b",
        messages=[{"role": "user", "content": "Hello"}]
    )
"""

import time
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import UsageRecord, TaskRecord
from routers.api_keys import validate_api_key
from services.task_queue import task_queue
from services.chain import get_token_balance
import config
import json
import asyncio

router = APIRouter(prefix="/v1", tags=["openai-compatible"])

# Available models (maps to Ollama model names)
AVAILABLE_MODELS = {
    "llama-3.2-1b": {"id": "llama-3.2-1b", "ollama": "llama3.2:1b", "cost_per_1k": 0.001},
    "llama-3.2-3b": {"id": "llama-3.2-3b", "ollama": "llama3.2:3b", "cost_per_1k": 0.003},
    "llama-3.1-8b": {"id": "llama-3.1-8b", "ollama": "llama3.1:8b", "cost_per_1k": 0.008},
}
DEFAULT_MODEL = "llama-3.2-3b"

# Rough token estimation (4 chars ≈ 1 token)
def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


# --- Request/Response schemas (OpenAI format) ---

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str = DEFAULT_MODEL
    messages: list[ChatMessage]
    temperature: float = 0.7
    max_tokens: int | None = None
    stream: bool = False

class Usage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

class Choice(BaseModel):
    index: int
    message: ChatMessage
    finish_reason: str

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[Choice]
    usage: Usage

class ModelInfo(BaseModel):
    id: str
    object: str = "model"
    created: int = 1700000000
    owned_by: str = "neuralmint"

class ModelList(BaseModel):
    object: str = "list"
    data: list[ModelInfo]


# --- Auth helper ---

def _extract_api_key(authorization: str = Header(None)) -> str:
    """Extract API key from Bearer token or raw key."""
    if not authorization:
        raise HTTPException(status_code=401, detail={
            "error": {"message": "Missing API key", "type": "invalid_request_error", "code": "missing_api_key"}
        })
    key = authorization.replace("Bearer ", "")
    if not key.startswith("nmt_sk_"):
        raise HTTPException(status_code=401, detail={
            "error": {"message": "Invalid API key format. Expected nmt_sk_xxx", "type": "invalid_request_error", "code": "invalid_api_key"}
        })
    return key


# --- Endpoints ---

@router.get("/models", response_model=ModelList)
async def list_models():
    """List available models (OpenAI-compatible)."""
    return ModelList(data=[
        ModelInfo(id=m["id"]) for m in AVAILABLE_MODELS.values()
    ])


@router.get("/models/{model_id}", response_model=ModelInfo)
async def get_model(model_id: str):
    if model_id not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail={"error": {"message": f"Model '{model_id}' not found", "type": "invalid_request_error"}})
    return ModelInfo(id=model_id)


@router.post("/chat/completions")
async def chat_completions(
    body: ChatCompletionRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db),
):
    """OpenAI-compatible chat completions endpoint."""
    # 1. Validate API key
    raw_key = _extract_api_key(authorization)
    api_key = validate_api_key(raw_key, db)
    if not api_key:
        raise HTTPException(status_code=401, detail={
            "error": {"message": "Invalid or revoked API key", "type": "authentication_error", "code": "invalid_api_key"}
        })

    # 2. Resolve model
    model_info = AVAILABLE_MODELS.get(body.model)
    if not model_info:
        raise HTTPException(status_code=400, detail={
            "error": {"message": f"Model '{body.model}' not available. Use /v1/models to list.", "type": "invalid_request_error"}
        })

    # 3. Check NMT balance
    wallet = api_key.wallet_address
    if config.TOKEN_ADDRESS:
        balance = await get_token_balance(wallet)
        if balance < config.COST_PER_PROMPT * 10**18:
            raise HTTPException(status_code=402, detail={
                "error": {"message": "Insufficient NMT balance", "type": "billing_error", "code": "insufficient_balance"}
            })

    # 4. Build prompt from messages
    prompt = "\n".join(
        f"{'User' if m.role == 'user' else 'Assistant' if m.role == 'assistant' else 'System'}: {m.content}"
        for m in body.messages
    )

    # 5. Create task
    start_time = time.time()
    task = task_queue.create_task(prompt, wallet)

    # 6. Record task in DB
    task_record = TaskRecord(
        task_id=task.task_id,
        api_key=raw_key,
        wallet_address=wallet,
        prompt=prompt,
        model=body.model,
    )
    db.add(task_record)
    db.commit()

    # 7. Wait for result
    if body.stream:
        return StreamingResponse(
            _stream_response(task.task_id, body.model, model_info, raw_key, wallet, start_time, db),
            media_type="text/event-stream",
        )

    result = await task_queue.wait_for_result(task.task_id)
    duration_ms = int((time.time() - start_time) * 1000)

    if not result or not result.result:
        raise HTTPException(status_code=504, detail={
            "error": {"message": "Request timed out. No miners available.", "type": "timeout_error"}
        })

    # 8. Calculate tokens and cost
    prompt_tokens = estimate_tokens(prompt)
    completion_tokens = estimate_tokens(result.result)
    total_tokens = prompt_tokens + completion_tokens
    nmt_cost = total_tokens / 1000 * model_info["cost_per_1k"]

    # 9. Record usage
    usage_record = UsageRecord(
        api_key=raw_key,
        wallet_address=wallet,
        model=body.model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        nmt_cost=nmt_cost,
        miner_address=result.miner_address,
        duration_ms=duration_ms,
    )
    db.add(usage_record)

    # Update task record
    task_record.response = result.result
    task_record.status = "completed"
    task_record.miner_address = result.miner_address
    task_record.prompt_tokens = prompt_tokens
    task_record.completion_tokens = completion_tokens
    task_record.nmt_cost = nmt_cost
    task_record.completed_at = datetime.now(timezone.utc)

    # Update API key stats
    api_key.total_tokens_used += total_tokens
    api_key.total_nmt_spent += nmt_cost
    db.commit()

    # 10. Return OpenAI-format response
    return ChatCompletionResponse(
        id=f"chatcmpl-{task.task_id[:12]}",
        created=int(time.time()),
        model=body.model,
        choices=[Choice(
            index=0,
            message=ChatMessage(role="assistant", content=result.result),
            finish_reason="stop",
        )],
        usage=Usage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        ),
    )


async def _stream_response(task_id, model, model_info, raw_key, wallet, start_time, db):
    """SSE streaming in OpenAI format."""
    result = await task_queue.wait_for_result(task_id)

    if not result or not result.result:
        error = {"error": {"message": "Timeout", "type": "timeout_error"}}
        yield f"data: {json.dumps(error)}\n\n"
        yield "data: [DONE]\n\n"
        return

    # Stream chunks
    text = result.result
    chunk_size = 20
    for i in range(0, len(text), chunk_size):
        chunk = text[i:i+chunk_size]
        data = {
            "id": f"chatcmpl-{task_id[:12]}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "delta": {"content": chunk},
                "finish_reason": None,
            }],
        }
        yield f"data: {json.dumps(data)}\n\n"
        await asyncio.sleep(0.02)

    # Final chunk
    final = {
        "id": f"chatcmpl-{task_id[:12]}",
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
    }
    yield f"data: {json.dumps(final)}\n\n"
    yield "data: [DONE]\n\n"

    # Record usage
    prompt_tokens = estimate_tokens("")
    completion_tokens = estimate_tokens(text)
    total_tokens = prompt_tokens + completion_tokens
    nmt_cost = total_tokens / 1000 * model_info["cost_per_1k"]
    duration_ms = int((time.time() - start_time) * 1000)

    usage = UsageRecord(
        api_key=raw_key, wallet_address=wallet, model=model,
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=total_tokens, nmt_cost=nmt_cost,
        miner_address=result.miner_address, duration_ms=duration_ms,
    )
    db.add(usage)
    db.commit()
