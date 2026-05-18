"""NeuralMint Miner Client - Hybrid AI + PoW mining."""

import asyncio
import json
import signal
import time
import websockets
from eth_account import Account
from eth_account.messages import encode_defunct

import config
from gpu_info import get_gpu_info
from ai_worker import run_inference, check_ollama
from pow_worker import mine_pow


class NeuralMintMiner:
    def __init__(self):
        self.account = Account.from_key(config.PRIVATE_KEY)
        self.address = self.account.address.lower()
        self.running = True
        self.tasks_completed = 0
        self.pow_solved = 0
        self.ws = None

    def sign_message(self, message: str) -> str:
        msg = encode_defunct(text=message)
        signed = self.account.sign_message(msg)
        return signed.signature.hex()

    async def connect(self):
        """Connect to the platform and start mining."""
        gpu = get_gpu_info()
        ollama_ok = await check_ollama()

        print(f"=== NeuralMint Miner ===")
        print(f"Address: {self.address}")
        print(f"GPU: {gpu.get('gpu_name', 'None detected')}")
        print(f"Ollama: {'ready' if ollama_ok else 'not available (PoW only)'}")
        print(f"Server: {config.WS_URL}")
        print()

        while self.running:
            try:
                async with websockets.connect(config.WS_URL) as ws:
                    self.ws = ws
                    await self._authenticate(ws, gpu, ollama_ok)
                    await self._mining_loop(ws, ollama_ok)
            except (websockets.ConnectionClosed, ConnectionRefusedError, OSError) as e:
                print(f"[miner] Connection lost: {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)

    async def _authenticate(self, ws, gpu: dict, ollama_ok: bool):
        """Send auth message with signed challenge."""
        message = f"NeuralMint Miner Auth\nAddress: {self.address}\nTimestamp: {int(time.time())}"
        signature = self.sign_message(message)

        await ws.send(json.dumps({
            "type": "auth",
            "address": self.address,
            "signature": f"0x{signature}",
            "message": message,
            "gpu_name": gpu.get("gpu_name"),
            "gpu_memory_mb": gpu.get("gpu_memory_mb"),
            "model_loaded": config.OLLAMA_MODEL if ollama_ok else None,
        }))

        resp = json.loads(await ws.recv())
        if resp.get("type") != "auth_ok":
            raise Exception(f"Auth failed: {resp}")
        print(f"[miner] Authenticated successfully")

    async def _mining_loop(self, ws, ollama_ok: bool):
        """Main loop: wait for AI tasks, mine PoW when idle."""
        print("[miner] Mining started. Waiting for tasks...")

        while self.running:
            try:
                # Wait for a message with short timeout
                raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                msg = json.loads(raw)

                if msg.get("type") == "ai_task":
                    await self._handle_ai_task(ws, msg, ollama_ok)
                elif msg.get("type") == "heartbeat_ack":
                    pass

            except asyncio.TimeoutError:
                # No task received, send heartbeat and do PoW
                await ws.send(json.dumps({"type": "heartbeat"}))
                # TODO: integrate PoW mining during idle
                # For now just log idle status
                pass

    async def _handle_ai_task(self, ws, msg: dict, ollama_ok: bool):
        """Process an AI inference task."""
        task_id = msg["task_id"]
        prompt = msg["prompt"]
        print(f"[miner] Received AI task {task_id[:8]}...")

        if not ollama_ok:
            await ws.send(json.dumps({
                "type": "task_result",
                "task_id": task_id,
                "result": "Error: Ollama not available on this miner",
            }))
            return

        try:
            start = time.time()
            result = await run_inference(prompt)
            elapsed = time.time() - start
            self.tasks_completed += 1

            await ws.send(json.dumps({
                "type": "task_result",
                "task_id": task_id,
                "result": result,
            }))

            print(f"[miner] Task {task_id[:8]} completed in {elapsed:.1f}s "
                  f"(total: {self.tasks_completed})")

        except Exception as e:
            print(f"[miner] Task {task_id[:8]} failed: {e}")
            await ws.send(json.dumps({
                "type": "task_result",
                "task_id": task_id,
                "result": f"Error: {str(e)}",
            }))

    def stop(self):
        self.running = False
        print("\n[miner] Shutting down...")


async def main():
    if not config.PRIVATE_KEY:
        print("Error: MINER_PRIVATE_KEY not set in .env")
        return

    miner = NeuralMintMiner()

    # Handle graceful shutdown
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, miner.stop)

    await miner.connect()


if __name__ == "__main__":
    asyncio.run(main())
