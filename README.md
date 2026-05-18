# NeuralMint

Decentralized AI API platform powered by crypto. Miners earn NMT tokens by providing GPU compute. Developers pay NMT to use an OpenAI-compatible API.

## How It Works

```
Developer's App (OpenAI SDK)
    │  just change base_url + api_key
    ▼
NeuralMint API (/v1/chat/completions)
    │  dispatches to available miners
    ▼
Miners (GPU + Ollama)
    │  run inference, earn NMT tokens
    ▼
Blockchain (Polygon Amoy)
    │  ERC-20 token, mining rewards, DEX
```

**For developers**: Use the OpenAI SDK, pay with crypto instead of credit card.

**For miners**: Earn NMT by lending your idle GPU.

## Quick Start

### 1. Backend

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && python main.py
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### 3. Miner (optional)

```bash
# Install Ollama first: https://ollama.com
ollama pull llama3.2:1b

cd miner
pip install -r requirements.txt
cp .env.example .env
# Set MINER_PRIVATE_KEY in .env
python main.py
```

### 4. Smart Contracts (optional)

```bash
cd contracts
forge build
forge test

# Deploy to Polygon Amoy
cp .env.example .env
# Set RELAYER_ADDRESS and PAIRED_TOKEN_ADDRESS
forge script script/Deploy.s.sol:Deploy --rpc-url $AMOY_RPC --broadcast
```

## API Usage

NeuralMint is fully compatible with the OpenAI SDK:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="nmt_sk_your_key_here"
)

response = client.chat.completions.create(
    model="llama-3.2-3b",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

## Available Models

| Model | Parameters | Cost / 1K tokens |
|-------|-----------|-----------------|
| `llama-3.2-1b` | 1B | 0.001 NMT |
| `llama-3.2-3b` | 3B | 0.003 NMT |
| `llama-3.1-8b` | 8B | 0.008 NMT |

## Tokenomics

- **Total supply**: 21,000,000 NMT (fixed, like Bitcoin)
- **Mining rewards**: 70% — released via halving schedule
- **Team**: 15% — minted at deploy
- **Liquidity**: 15% — added to built-in DEX
- **Halving**: every 10,000 mining claims, reward halves (50 → 25 → 12.5...)

## Tech Stack

- **Smart Contracts**: Solidity 0.8.24 + Foundry + OpenZeppelin
- **Backend**: FastAPI + web3.py + SQLAlchemy
- **Frontend**: React 19 + Vite + TypeScript + ethers.js v6
- **Miner**: Python + Ollama + WebSocket
- **Chain**: Polygon Amoy testnet
