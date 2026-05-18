"""WebSocket endpoint for miner connections."""

import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from models.schemas import MinerInfo, MinerStatus
from services.miner_manager import miner_manager
from services.chain import verify_signature

router = APIRouter(tags=["miner-ws"])


@router.websocket("/api/miners/ws")
async def miner_websocket(ws: WebSocket):
    await ws.accept()
    miner_address = None

    try:
        # Step 1: Authenticate miner
        auth_msg = await ws.receive_json()
        if auth_msg.get("type") != "auth":
            await ws.send_json({"type": "error", "message": "Expected auth message"})
            await ws.close()
            return

        address = auth_msg.get("address", "")
        signature = auth_msg.get("signature", "")
        message = auth_msg.get("message", "")

        if not verify_signature(address, message, signature):
            await ws.send_json({"type": "error", "message": "Invalid signature"})
            await ws.close()
            return

        miner_address = address.lower()

        # Step 2: Register miner
        info = MinerInfo(
            address=miner_address,
            gpu_name=auth_msg.get("gpu_name"),
            gpu_memory_mb=auth_msg.get("gpu_memory_mb"),
            model_loaded=auth_msg.get("model_loaded"),
            status=MinerStatus.ONLINE,
        )
        await miner_manager.register(miner_address, ws, info)

        await ws.send_json({
            "type": "auth_ok",
            "message": f"Miner {miner_address} registered",
        })

        # Step 3: Main message loop
        while True:
            msg = await ws.receive_json()
            msg_type = msg.get("type")

            if msg_type == "task_result":
                task_id = msg.get("task_id")
                result = msg.get("result", "")
                if task_id:
                    await miner_manager.handle_task_result(miner_address, task_id, result)

            elif msg_type == "heartbeat":
                await ws.send_json({"type": "heartbeat_ack"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[ws] Error for miner {miner_address}: {e}")
    finally:
        if miner_address:
            await miner_manager.unregister(miner_address)
