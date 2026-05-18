"""Server-side PoW validation to pre-check before on-chain submission."""

from web3 import Web3


def validate_pow(miner_address: str, block_hash: str, nonce: int, difficulty: int) -> bool:
    """Validate a PoW solution matches what the smart contract would accept.

    The hash must match: keccak256(abi.encodePacked(miner, blockHash, nonce)) <= difficulty
    """
    try:
        packed = Web3.solidity_keccak(
            ["address", "bytes32", "uint256"],
            [
                Web3.to_checksum_address(miner_address),
                bytes.fromhex(block_hash.replace("0x", "")),
                nonce,
            ],
        )
        return int.from_bytes(packed, "big") <= difficulty
    except Exception:
        return False


def get_current_challenge(w3_instance) -> dict:
    """Get the current PoW challenge parameters."""
    try:
        block = w3_instance.eth.get_block("latest")
        return {
            "last_hash": block["hash"].hex(),
            "block_number": block["number"],
        }
    except Exception:
        return {
            "last_hash": "0x" + "0" * 64,
            "block_number": 0,
        }
