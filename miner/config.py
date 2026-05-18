import os
from dotenv import load_dotenv

load_dotenv()

# Backend server
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000")
WS_URL = os.getenv("WS_URL", "ws://localhost:8000/api/miners/ws")

# Miner wallet
PRIVATE_KEY = os.getenv("MINER_PRIVATE_KEY", "")

# Ollama
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")

# PoW
POW_THREADS = int(os.getenv("POW_THREADS", "4"))

# Blockchain (for PoW submission)
RPC_URL = os.getenv("RPC_URL", "https://rpc-amoy.polygon.technology")
MINING_REWARD_ADDRESS = os.getenv("MINING_REWARD_ADDRESS", "")
