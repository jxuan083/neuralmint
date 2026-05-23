# NeuralMint

**去中心化 AI API 平台。** 礦工提供 GPU 算力賺取 NMB token；開發者用 NMB 支付，透過 OpenAI 相容 API 使用 LLM 推論服務。

> 只需改一行 `base_url`，用加密貨幣取代信用卡。

---

## How It Works

```
Developer's App (OpenAI SDK)
    │  just change base_url + api_key
    ▼
NeuralMint API (/v1/chat/completions)
    │  dispatches to available miners
    ▼
Miners (GPU + Ollama)
    │  run inference, earn NMB tokens
    ▼
Blockchain (Polygon Amoy)
    │  ERC-20 token · Mining rewards · DEX · DAO
```

**For developers** — Use the OpenAI SDK, pay with crypto, no credit card needed.

**For miners** — Earn NMB by lending your idle GPU.

---

## Architecture

```
┌─────────────────────────────────────────┐
│           FastAPI Backend (:8000)        │
│  /v1/*          OpenAI-compatible API   │
│  /api/keys      API key management      │
│  /api/usage     Usage statistics        │
│  /api/miners/ws Miner WebSocket         │
│  /api/tokens    Token stats             │
│  /api/auth      Wallet-based auth       │
└──────────┬──────────────────────────────┘
           │ web3.py
           ▼
┌──────────────────────────┐     ┌─────────────────────┐
│  Polygon Amoy Testnet    │     │  Miner Client (Py)  │
│  NeuralMintToken (NMB)   │     │  Ollama AI worker   │
│  MiningReward (halving)  │     │  PoW hash grinder   │
│  MinerStaking            │     │  WebSocket to backend│
│  SimpleAMM (DEX)         │     └─────────────────────┘
│  Governance (DAO)        │
└──────────────────────────┘

Frontend (React + Vite)
  /dashboard   Usage charts
  /keys        API key CRUD
  /docs        Integration docs
  /miner       Miner status dashboard
  /swap        DEX swap interface
  /governance  DAO proposals & voting
```

---

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `NeuralMintToken` | ERC-20, 21M fixed supply, minter-locked |
| `MiningReward` | Halving schedule (50→25→12.5 NMB), PoW difficulty adjustment |
| `MinerStaking` | Stake NMB to become eligible miner, slash mechanism |
| `SimpleAMM` | x×y=k DEX, NMB/MATIC pair, 0.3% fee |
| `Governance` | DAO voting — 1 NMB = 1 vote, 3-day period, 1-day timelock |

---

## DAO Governance

NMB holders control platform parameters via on-chain proposals.

- **Proposal threshold**: 1,000 NMB
- **Quorum**: 100,000 NMB
- **Voting period**: 3 days
- **Timelock**: 1 day before execution
- MinerStaking ownership transferred to Governance at deploy — DAO has real control

---

## Tokenomics

| Allocation | % | Amount | Mechanism |
|------------|---|--------|-----------|
| Mining | 70% | 14,700,000 NMB | MiningReward halving release |
| Team | 15% | 3,150,000 NMB | ownerMint at deploy |
| Liquidity | 15% | 3,150,000 NMB | ownerMint → addLiquidity to AMM |

**Halving**: every 10,000 mining claims, reward halves (50 → 25 → 12.5... floor: 0.001 NMB)

---

## Quick Start

### 1. Backend

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && python main.py
# API at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### 3. Miner

```bash
# Install Ollama: https://ollama.com
ollama pull llama3.2:1b

cd miner
pip install -r requirements.txt
cp .env.example .env   # set MINER_PRIVATE_KEY
python main.py
```

### 4. Smart Contracts

```bash
cd contracts
forge build
forge test   # 43 tests

# Deploy to Polygon Amoy
cp .env.example .env   # set RELAYER_ADDRESS, PAIRED_TOKEN_ADDRESS
forge script script/Deploy.s.sol:Deploy --rpc-url $AMOY_RPC --broadcast
```

---

## API Usage

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
| `llama-3.2-1b` | 1B | 0.001 NMB |
| `llama-3.2-3b` | 3B | 0.003 NMB |
| `llama-3.1-8b` | 8B | 0.008 NMB |

---

## Vision

撐過冷啟動之後，飛輪就能自行運轉。

| 規模 | 礦工數 | 日均 API 呼叫 | 意義 |
|------|--------|--------------|------|
| 冷啟動完成 | 500 | 10,000 | NMB 形成真實市價 |
| 成長期 | 10,000 | 500,000 | 比中心化便宜 40% |
| 規模化 | 100,000 | 1,000 萬 | 企業級採用開始 |
| 成熟生態 | **1,000,000** | 1 億+ | 無法被關閉的 AI 基礎設施 |

百萬礦工規模下，NeuralMint 的算力超越任何單一雲端供應商，且物理上無法被任何政府或企業關閉。

→ [完整願景文件](docs/vision.md)

---

## Tech Stack

- **Smart Contracts**: Solidity 0.8.24 + Foundry + OpenZeppelin
- **Backend**: FastAPI + web3.py + SQLAlchemy (SQLite)
- **Frontend**: React 19 + Vite + TypeScript + ethers.js v6 + recharts
- **Miner**: Python + Ollama + WebSocket
- **Chain**: Polygon Amoy testnet
