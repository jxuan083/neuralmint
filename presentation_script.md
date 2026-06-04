# NeuralMint — Presentation Script (Pages 1–5)

---

## Page 1 · Title Slide

Good morning/afternoon, everyone. Today I'd like to present **NeuralMint** — a decentralized AI API platform built on Polygon Amoy.

The core idea is simple: **minting AI economy tokens with GPU power**. Instead of paying OpenAI or Google with a credit card, developers pay with NMT tokens, and miners earn those tokens by contributing their idle GPUs. The tech stack is Solidity, FastAPI, and React, and the token supply is hard-capped at 21 million — just like Bitcoin.

---

## Page 2 · Ch 01 — Naming & Motivation

So why "NeuralMint"? The name is the thesis.

**Neural** — as in neural networks. This is the product. Miners contribute GPU power to run large language model inference.

**Mint** — as in minting tokens. Every time a miner completes an AI inference task, the smart contract mints NMT as a reward. And "mint" also carries the meaning of "brand new" — because this is a fundamentally new model for the AI economy.

Put them together: **neural inference mints a new AI economy**. The token isn't backed by speculation — it's backed by real computation.

---

## Page 3 · Ch 02 — Why It Matters

Let's talk about the problem. There is a fundamental contradiction in AI compute today: **some people lack computing power, while others waste it**.

And the only option right now? Buy from monopolies — OpenAI, Google, Anthropic. That creates three real pain points:

First, **the excluded**. Developers in developing countries can't even access these APIs. They lack international credit cards, face regional blocks, and deal with account bans. Indie developers are forced to accept big-tech pricing with zero alternatives.

Second, **the mismatch**. From my own experience — when I run AI agents locally, my GPU maxes out and I can't do anything else. But when I'm not running agents, that same GPU sits completely idle. This supply-demand timing mismatch is everywhere.

So what's **NeuralMint's answer**? Be a miner and a user at the same time. When your GPU is idle, mine NMT. When you need compute, use someone else's GPU and pay with the tokens you earned. No credit card, no verification, no region blocks. And for developers, migration cost is literally one line of code — just change `base_url`.

---

## Page 4 · Ch 03 — System Overview

The system has three participants that form a minimum viable economy.

On the **demand side**, developers. They point the standard OpenAI SDK's `base_url` to NeuralMint and pay with NMT instead of a credit card. The API is fully OpenAI-compatible — `POST /v1/chat/completions` with a Bearer token.

In the **matching layer**, our FastAPI backend. It implements the full OpenAI REST spec, dispatches tasks to miners via WebSocket, and uses a relayer pattern to pay gas on behalf of miners so they don't need to hold MATIC.

On the **supply side**, miners. They run Ollama locally for GPU inference, stake NMT to become eligible for tasks, earn NMT rewards on completion, and switch to proof-of-work mining when idle.

All three settle automatically via on-chain tokens. No intermediary holds funds, no platform takes a cut beyond gas costs.

---

## Page 5 · Demo — End-to-End Screenshots

Let me show you how simple it is in practice. It takes just a two-line change to switch from OpenAI to decentralized compute.

Here's the Python code — you `pip install openai`, create the client with `base_url` pointing to NeuralMint and your `nmt_sk_` API key, and call `client.chat.completions.create()` exactly as you would with OpenAI. That's it. Zero learning curve.

On the miner side, tasks arrive in real time via WebSocket. The miner picks up the job, runs inference through Ollama, and returns the result. The response format is identical to OpenAI's JSON spec — `chat.completion` object with choices, usage, and all the standard fields.

And in the developer dashboard, you can manage API keys, monitor usage, and see your token balance — all from `localhost:5177`.

I'll run the live demo after the slides to show this flow end-to-end: API call, miner inference, on-chain reward minting, and balance changes — all happening in real time.
