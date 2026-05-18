"""PoW mining worker - grinds hashes when no AI tasks are available."""

import hashlib
import os
import time
from web3 import Web3
from concurrent.futures import ThreadPoolExecutor
from typing import Optional


def _try_nonces(miner_address: str, block_hash: bytes, difficulty: int,
                start: int, count: int) -> Optional[int]:
    """Try a range of nonces, return the first valid one or None."""
    addr_bytes = bytes.fromhex(miner_address.replace("0x", ""))

    for nonce in range(start, start + count):
        # Match Solidity: keccak256(abi.encodePacked(msg.sender, blockhash, nonce))
        packed = addr_bytes + block_hash + nonce.to_bytes(32, "big")
        h = Web3.keccak(packed)
        if int.from_bytes(h, "big") <= difficulty:
            return nonce
    return None


async def mine_pow(miner_address: str, block_hash: str, difficulty: int,
                   batch_size: int = 100_000, max_attempts: int = 10_000_000) -> Optional[int]:
    """Mine PoW by trying nonces until a valid hash is found.

    Returns the valid nonce or None if max_attempts reached.
    """
    block_hash_bytes = bytes.fromhex(block_hash.replace("0x", ""))
    start_nonce = int.from_bytes(os.urandom(4), "big") * 1000  # random start

    attempts = 0
    start_time = time.time()

    while attempts < max_attempts:
        result = _try_nonces(miner_address, block_hash_bytes, difficulty,
                             start_nonce + attempts, batch_size)
        if result is not None:
            elapsed = time.time() - start_time
            hashrate = (attempts + (result - start_nonce - attempts)) / elapsed if elapsed > 0 else 0
            print(f"[pow] Found valid nonce {result} in {elapsed:.1f}s ({hashrate:.0f} H/s)")
            return result

        attempts += batch_size

    return None
