"""In-memory task queue for dispatching AI inference tasks to miners."""

import asyncio
import uuid
import time
import hashlib
from typing import Optional
from models.schemas import AITask, TaskStatus
import config


class TaskQueue:
    def __init__(self):
        self._queue: asyncio.Queue[AITask] = asyncio.Queue()
        self._tasks: dict[str, AITask] = {}
        self._results: dict[str, asyncio.Event] = {}

    def create_task(self, prompt: str, user_address: str) -> AITask:
        task_id = str(uuid.uuid4())
        task = AITask(
            task_id=task_id,
            prompt=prompt,
            user_address=user_address,
        )
        self._tasks[task_id] = task
        self._results[task_id] = asyncio.Event()
        self._queue.put_nowait(task)
        return task

    async def get_next_task(self, timeout: float = 5.0) -> Optional[AITask]:
        """Get next task from queue. Returns None on timeout."""
        try:
            task = await asyncio.wait_for(self._queue.get(), timeout=timeout)
            task.status = TaskStatus.ASSIGNED
            return task
        except asyncio.TimeoutError:
            return None

    def complete_task(self, task_id: str, result: str, miner_address: str):
        task = self._tasks.get(task_id)
        if not task:
            return
        task.status = TaskStatus.COMPLETED
        task.result = result
        task.miner_address = miner_address
        self._results[task_id].set()

    def fail_task(self, task_id: str):
        task = self._tasks.get(task_id)
        if not task:
            return
        task.status = TaskStatus.FAILED
        # Re-queue for another miner
        task.status = TaskStatus.QUEUED
        task.miner_address = None
        self._queue.put_nowait(task)

    async def wait_for_result(self, task_id: str, timeout: float = None) -> Optional[AITask]:
        timeout = timeout or config.TASK_TIMEOUT_SECONDS
        event = self._results.get(task_id)
        if not event:
            return None
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            return self._tasks.get(task_id)
        except asyncio.TimeoutError:
            task = self._tasks.get(task_id)
            if task:
                task.status = TaskStatus.TIMEOUT
            return task

    def get_task(self, task_id: str) -> Optional[AITask]:
        return self._tasks.get(task_id)

    @property
    def pending_count(self) -> int:
        return self._queue.qsize()

    @staticmethod
    def task_id_to_bytes32(task_id: str) -> bytes:
        """Convert task UUID to bytes32 for on-chain submission."""
        return hashlib.sha256(task_id.encode()).digest()


# Singleton
task_queue = TaskQueue()
