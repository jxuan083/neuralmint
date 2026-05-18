# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NeuralMint is a decentralized AI API platform. Miners contribute GPU power to earn NMT tokens. Developers pay NMT to use an **OpenAI-compatible API** — just change `base_url` and `api_key` in the OpenAI SDK. Hybrid mining: AI inference tasks (full reward) + PoW hash mining when idle (30% reward). Fixed 21M supply with Bitcoin-like halving. Built-in DEX for token trading.

## Commands

```bash
# --- Contracts (Foundry) ---
cd contracts && forge build
cd contracts && forge test
cd contracts && forge test -vvv                              # verbose
cd contracts && forge test --match-test test_SubmitAITask -vvv  # single test
cd contracts && forge test --match-path test/MiningReward.t.sol  # single file
cd contracts && forge test --fuzz-runs 1000                   # fuzz
cd contracts && forge test --gas-report
cd contracts && forge fmt
cd contracts && forge script script/Deploy.s.sol:Deploy --rpc-url $AMOY_RPC --broadcast
anvil  # local dev node

# --- Backend (FastAPI) ---
cd backend && pip install -r requirements.txt
cd backend && python main.py                    # starts on :8000

# --- Frontend (React + Vite) ---
cd frontend && npm install
cd frontend && npm run dev                      # starts on :5173
cd frontend && npm run build                    # production build

# --- Miner Client ---
cd miner && pip install -r requirements.txt
cd miner && python main.py                      # connect to backend and mine
```

## Architecture

```
Developer's App (OpenAI SDK)
    │  POST /v1/chat/completions
    │  Header: Authorization: Bearer nmt_sk_xxx
    ▼
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
│  NeuralMintToken ERC-20  │     │  Ollama AI worker   │
│  MiningReward (halving)  │     │  PoW hash grinder   │
│  MinerStaking            │     │  WebSocket to backend│
│  SimpleAMM (DEX)         │     └─────────────────────┘
└──────────────────────────┘

Frontend (React + Vite) → Developer Dashboard
  /dashboard   Usage charts
  /keys        API key CRUD
  /docs        Integration docs (Python/JS/cURL examples)
  /miner       Miner status dashboard
  /swap        DEX swap interface
```

### Smart Contract Relationships

```
NeuralMintToken (ERC-20, 21M cap)
    ↑ mint()                    ↑ transferFrom()
    │                           │
MiningReward                MinerStaking
(halving, PoW,              (stake/unstake/slash,
 relayer submits)            eligibility gate)

SimpleAMM (NMT/WMATIC pair, x*y=k, 0.3% fee)
```

### Key Backend Files

- `routers/openai_compat.py` — `/v1/chat/completions`, `/v1/models` (the main product)
- `routers/api_keys.py` — API key CRUD, tied to wallet addresses
- `routers/usage.py` — Usage summary + recent requests
- `services/task_queue.py` — In-memory task dispatch to miners
- `services/miner_manager.py` — WebSocket miner registry + Ollama fallback
- `services/chain.py` — web3.py contract interactions
- `db/models.py` — SQLite: ApiKey, UsageRecord, TaskRecord

### Tokenomics

| Allocation | % | Amount | Mechanism |
|---|---|---|---|
| Mining | 70% | 14,700,000 | MiningReward halving release |
| Team | 15% | 3,150,000 | ownerMint at deploy |
| Liquidity | 15% | 3,150,000 | ownerMint → addLiquidity to AMM |

## Tech Stack

- **Solidity 0.8.24** + Foundry + OpenZeppelin
- **FastAPI** + web3.py + SQLAlchemy (SQLite)
- **React 19** + Vite + TypeScript + ethers.js v6 + recharts
- **Python** miner client + Ollama
- Target chain: **Polygon Amoy testnet**

## Conventions

- All responses in Traditional Chinese
- Custom errors over require strings (gas efficiency)
- Relayer pattern: backend pays gas, miners don't need MATIC
- API format follows OpenAI spec exactly for SDK compatibility
