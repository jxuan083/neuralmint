import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# --- Server ---
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# --- JWT ---
JWT_SECRET = os.getenv("JWT_SECRET", "neuralmint-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

# --- Blockchain ---
RPC_URL = os.getenv("RPC_URL", "https://rpc-amoy.polygon.technology")
CHAIN_ID = int(os.getenv("CHAIN_ID", "80002"))  # Polygon Amoy

# Contract addresses (set after deployment)
TOKEN_ADDRESS = os.getenv("TOKEN_ADDRESS", "")
MINING_REWARD_ADDRESS = os.getenv("MINING_REWARD_ADDRESS", "")
MINER_STAKING_ADDRESS = os.getenv("MINER_STAKING_ADDRESS", "")
AMM_ADDRESS = os.getenv("AMM_ADDRESS", "")

# Backend hot wallet (relayer) private key
RELAYER_PRIVATE_KEY = os.getenv("RELAYER_PRIVATE_KEY", "")

# --- AI / Ollama fallback ---
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
FALLBACK_ENABLED = os.getenv("FALLBACK_ENABLED", "true").lower() == "true"

# --- Mining ---
COST_PER_PROMPT = int(os.getenv("COST_PER_PROMPT", "1"))  # NMT per prompt (in whole tokens)
TASK_TIMEOUT_SECONDS = int(os.getenv("TASK_TIMEOUT_SECONDS", "60"))

# --- ABI paths ---
CONTRACTS_OUT = Path(__file__).parent.parent / "contracts" / "out"


def load_abi(contract_name: str) -> list:
    """Load ABI from Foundry output."""
    import json
    abi_path = CONTRACTS_OUT / f"{contract_name}.sol" / f"{contract_name}.json"
    if not abi_path.exists():
        return []
    with open(abi_path) as f:
        return json.load(f)["abi"]
