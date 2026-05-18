"""Chat endpoint - user sends prompt, gets AI response via miner network."""

import asyncio
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from models.schemas import ChatRequest, ChatResponse
from services.task_queue import task_queue
from services.chain import get_token_balance
from routers.auth import get_address_from_token
import config

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def submit_chat(body: ChatRequest, authorization: str = Header(None)):
    """Submit a prompt. Deducts tokens, queues task for miners."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")

    address = get_address_from_token(authorization.replace("Bearer ", ""))
    if not address:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    # Check balance (skip if contracts not deployed yet)
    if config.TOKEN_ADDRESS:
        balance = await get_token_balance(address)
        cost_wei = config.COST_PER_PROMPT * 10**18
        if balance < cost_wei:
            raise HTTPException(status_code=402, detail="Insufficient NMT balance")

    # Create and queue task
    task = task_queue.create_task(body.prompt, address)

    return ChatResponse(task_id=task.task_id, status="queued")


@router.get("/stream/{task_id}")
async def stream_result(task_id: str):
    """SSE stream that waits for the task result and sends it."""
    task = task_queue.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_stream():
        yield f"data: {{'status': 'waiting', 'task_id': '{task_id}'}}\n\n"

        result_task = await task_queue.wait_for_result(task_id)
        if result_task and result_task.result:
            # Send result in chunks for streaming feel
            chunks = [result_task.result[i:i+50] for i in range(0, len(result_task.result), 50)]
            for chunk in chunks:
                escaped = chunk.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
                yield f"data: {{'status': 'streaming', 'chunk': '{escaped}'}}\n\n"
                await asyncio.sleep(0.05)

            yield f"data: {{'status': 'done', 'miner': '{result_task.miner_address}'}}\n\n"
        else:
            yield f"data: {{'status': 'timeout'}}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
