"""Manages connected miners and dispatches tasks via WebSocket."""

import asyncio
import json
import time
import httpx
from typing import Optional
from fastapi import WebSocket
from models.schemas import MinerInfo, MinerStatus, AITask
from services.task_queue import task_queue
from services import chain
import config


class MinerManager:
    def __init__(self):
        self._miners: dict[str, MinerInfo] = {}
        self._connections: dict[str, WebSocket] = {}
        self._dispatcher_task: Optional[asyncio.Task] = None

    async def register(self, address: str, ws: WebSocket, info: MinerInfo):
        self._miners[address] = info
        self._connections[address] = ws

    async def unregister(self, address: str):
        self._miners.pop(address, None)
        self._connections.pop(address, None)

    def get_available_miner(self) -> Optional[str]:
        """Find an online (non-busy) miner."""
        for addr, info in self._miners.items():
            if info.status == MinerStatus.ONLINE and addr in self._connections:
                return addr
        return None

    async def dispatch_task(self, task: AITask) -> bool:
        """Send a task to an available miner. Returns True if dispatched."""
        miner_addr = self.get_available_miner()
        if not miner_addr:
            return False

        ws = self._connections.get(miner_addr)
        if not ws:
            return False

        info = self._miners[miner_addr]
        info.status = MinerStatus.BUSY
        task.miner_address = miner_addr

        try:
            await ws.send_json({
                "type": "ai_task",
                "task_id": task.task_id,
                "prompt": task.prompt,
            })
            return True
        except Exception:
            info.status = MinerStatus.ONLINE
            return False

    async def handle_task_result(self, miner_address: str, task_id: str, result: str):
        """Process result from miner, reward on-chain."""
        info = self._miners.get(miner_address)
        if info:
            info.status = MinerStatus.ONLINE
            info.tasks_completed += 1

        task_queue.complete_task(task_id, result, miner_address)

        # Reward miner on-chain
        task_bytes = task_queue.task_id_to_bytes32(task_id)
        tx_hash = await chain.submit_ai_task_reward(miner_address, task_bytes)
        if tx_hash and info:
            # Approximate: use current reward value
            info.tokens_earned += 50  # simplified

    async def start_dispatcher(self):
        """Background loop: pull tasks from queue, dispatch to miners or fallback."""
        self._dispatcher_task = asyncio.create_task(self._dispatch_loop())

    async def _dispatch_loop(self):
        while True:
            task = await task_queue.get_next_task(timeout=2.0)
            if not task:
                continue

            dispatched = await self.dispatch_task(task)
            if not dispatched:
                # No miners: use local Ollama fallback if enabled
                if config.FALLBACK_ENABLED:
                    await self._fallback_inference(task)
                else:
                    task_queue.fail_task(task.task_id)

    async def _fallback_inference(self, task: AITask):
        """Run inference locally via Ollama when no miners are available."""
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{config.OLLAMA_URL}/api/generate",
                    json={
                        "model": config.OLLAMA_MODEL,
                        "prompt": task.prompt,
                        "stream": False,
                    },
                )
                data = resp.json()
                result = data.get("response", "")
                task_queue.complete_task(task.task_id, result, "fallback-local")
        except Exception as e:
            print(f"[fallback] Ollama error: {e}")
            task_queue.complete_task(
                task.task_id,
                f"Error: No miners available and local inference failed.",
                "fallback-local",
            )

    @property
    def active_miners(self) -> list[MinerInfo]:
        return [m for m in self._miners.values() if m.status != MinerStatus.OFFLINE]

    @property
    def active_count(self) -> int:
        return len(self.active_miners)


# Singleton
miner_manager = MinerManager()
