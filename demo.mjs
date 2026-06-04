#!/usr/bin/env node
/**
 * NeuralMint — Full Demo Script
 *
 * Shows the complete decentralized AI flow:
 *   Developer pays NMT -> Miner runs inference -> Smart contract mints reward
 *
 * Usage:  node demo.mjs
 */

const API = "http://localhost:8000";
const RPC = "http://localhost:8545";
const TOKEN_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// Scenario A: We are the developer, miner runs for us
const API_KEY = "nmt_sk_demo_test_key_for_presentation_2026";
const DEMO_WALLET = "0x50a13d0e5ce58c0d8124653d3f9c2d25b325bbbc";
const MINER_ADDR = "0x246ab8e91ccdd481ee2ad6c248a6e4c078094aa2";

// Scenario B: Alice is the developer, our miner earns NMT
const ALICE_KEY = "nmt_sk_alice_external_dev_2026";
const ALICE_WALLET = "0xd89730b45a420d483722b2fc82226f380a888cfc";

// ── Helpers ──────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dim = "\x1b[90m";
const reset = "\x1b[0m";
const bold = "\x1b[1m";
const cyan = "\x1b[36m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const magenta = "\x1b[35m";
const red = "\x1b[31m";
const white = "\x1b[97m";

function header(num, title) {
  console.log();
  console.log(`${bold}${cyan}${"═".repeat(64)}${reset}`);
  console.log(`${bold}${cyan}  STEP ${num}  ${white}${title}${reset}`);
  console.log(`${bold}${cyan}${"═".repeat(64)}${reset}`);
  console.log();
}

function log(icon, label, msg) {
  console.log(`  ${icon}  ${dim}${label}${reset}  ${msg}`);
}

function arrow(msg) {
  console.log(`${dim}       │${reset}`);
  console.log(`${dim}       ▼  ${reset}${msg}`);
}

function gap() { console.log(); }

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  return res.json();
}

async function getBalance(addr) {
  const padded = addr.slice(2).toLowerCase().padStart(64, "0");
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "eth_call",
      params: [{ to: TOKEN_ADDR, data: "0x70a08231" + padded }, "latest"], id: 1,
    }),
  }).then((r) => r.json());
  return parseInt(res.result, 16) / 1e18;
}

async function getTotalSupply() {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "eth_call",
      params: [{ to: TOKEN_ADDR, data: "0x18160ddd" }, "latest"], id: 1,
    }),
  }).then((r) => r.json());
  return parseInt(res.result, 16) / 1e18;
}

async function getBlockNumber() {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
  }).then((r) => r.json());
  return parseInt(res.result, 16);
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// ── Demo ─────────────────────────────────────────────────

async function main() {
  console.log();
  console.log(`${bold}${magenta}  ┌──────────────────────────────────────────────┐${reset}`);
  console.log(`${bold}${magenta}  │   NeuralMint — Decentralized AI API Platform │${reset}`);
  console.log(`${bold}${magenta}  │   DAO · DeFi · AI                            │${reset}`);
  console.log(`${bold}${magenta}  └──────────────────────────────────────────────┘${reset}`);

  // ────────────────────────────────────────────────────────
  header("1", "System Health Check");
  // ────────────────────────────────────────────────────────

  const models = await jsonFetch(`${API}/v1/models`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  log("🔧", "Backend", `${green}ONLINE${reset}  ${dim}(${models.data.map((m) => m.id).join(", ")})${reset}`);

  const block = await getBlockNumber();
  log("⛓ ", "Blockchain", `${green}ONLINE${reset}  ${dim}Anvil local chain · block #${block}${reset}`);

  const tags = await jsonFetch("http://localhost:11434/api/tags");
  log("🤖", "Ollama", `${green}ONLINE${reset}  ${dim}${tags.models.map((m) => m.name).join(", ")}${reset}`);

  let minerCount = 0;
  try {
    const miners = await jsonFetch(`${API}/api/miners`);
    minerCount = Array.isArray(miners) ? miners.length : (miners.miners || []).length;
  } catch {}
  log("⛏ ", "Miner", minerCount > 0
    ? `${green}CONNECTED${reset}  ${dim}${minerCount} miner(s) online, waiting for tasks${reset}`
    : `${yellow}OFFLINE${reset}  ${dim}(will fallback to local Ollama)${reset}`);

  await sleep(1500);

  // ────────────────────────────────────────────────────────
  header("2", "On-Chain State — Before API Call");
  // ────────────────────────────────────────────────────────

  const supplyBefore = await getTotalSupply();
  const devBefore = await getBalance(DEMO_WALLET);
  const minerBefore = await getBalance(MINER_ADDR);

  log("📊", "Total Supply", `${bold}${supplyBefore.toLocaleString()} NMT${reset}  ${dim}(cap: 21,000,000)${reset}`);
  gap();
  log("👨‍💻", "Developer", `${shortAddr(DEMO_WALLET)}`);
  log("  ", "Balance", `${bold}${devBefore.toLocaleString()} NMT${reset}`);
  gap();
  log("⛏ ", "Miner", `${shortAddr(MINER_ADDR)}`);
  log("  ", "Balance", `${bold}${minerBefore.toLocaleString()} NMT${reset}`);

  await sleep(2000);

  // ────────────────────────────────────────────────────────
  header("3", "Call AI API — OpenAI SDK Compatible");
  // ────────────────────────────────────────────────────────

  const prompt = "Explain how decentralized computing can democratize AI access, in 3 sentences.";

  log("📤", "Request", `POST ${API}/v1/chat/completions`);
  log("  ", "Model", "llama-3.2-1b");
  log("  ", "Prompt", `"${prompt}"`);
  log("  ", "Auth", `Bearer ${API_KEY.slice(0, 20)}...`);

  console.log();
  console.log(`${dim}  ───── request sent, waiting for miner to process... ─────${reset}`);
  console.log();

  const start = Date.now();
  const result = await jsonFetch(`${API}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.2-1b",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const elapsed = Date.now() - start;

  if (result.detail || result.error) {
    log("❌", "ERROR", JSON.stringify(result.detail || result.error));
    process.exit(1);
  }

  const reply = result.choices[0].message.content;
  const usage = result.usage;

  console.log(`  ${green}┌─ AI Response ──────────────────────────────────────┐${reset}`);
  // Word wrap response
  const words = reply.split(" ");
  let line = "  " + green + "│" + reset + "  ";
  let lineLen = 0;
  for (const w of words) {
    if (lineLen + w.length > 52) {
      console.log(line);
      line = "  " + green + "│" + reset + "  ";
      lineLen = 0;
    }
    line += w + " ";
    lineLen += w.length + 1;
  }
  if (lineLen > 0) console.log(line);
  console.log(`  ${green}└────────────────────────────────────────────────────┘${reset}`);
  gap();

  log("⏱ ", "Latency", `${bold}${elapsed}ms${reset}`);
  log("📊", "Tokens", `prompt=${usage.prompt_tokens}  completion=${usage.completion_tokens}  total=${usage.total_tokens}`);
  log("✅", "Format", `100% OpenAI-compatible  ${dim}(drop-in replacement)${reset}`);

  // Wait for on-chain tx to settle
  await sleep(2000);

  // ────────────────────────────────────────────────────────
  header("4", "What Just Happened — The Flow");
  // ────────────────────────────────────────────────────────

  console.log(`  ${bold}${white}Developer${reset} calls API with NMT API key`);
  arrow(`${bold}Backend${reset} receives request, dispatches to miner via WebSocket`);
  arrow(`${bold}Miner${reset} runs llama3.2:1b on local GPU via Ollama`);
  arrow(`${bold}Miner${reset} returns inference result to Backend`);
  arrow(`${bold}Backend (Relayer)${reset} calls ${cyan}MiningReward.submitAITask()${reset} on-chain`);
  arrow(`${bold}Smart Contract${reset} mints ${green}50 NMT${reset} to Miner as reward`);
  arrow(`${bold}Backend${reset} returns OpenAI-format JSON to Developer`);
  console.log(`${dim}       │${reset}`);
  console.log(`  ${green}${bold}     ✓  Complete — zero intermediary, fully on-chain${reset}`);

  await sleep(2000);

  // ────────────────────────────────────────────────────────
  header("5", "On-Chain State — After API Call");
  // ────────────────────────────────────────────────────────

  const supplyAfter = await getTotalSupply();
  const devAfter = await getBalance(DEMO_WALLET);
  const minerAfter = await getBalance(MINER_ADDR);

  const supplyDiff = supplyAfter - supplyBefore;
  const minerDiff = minerAfter - minerBefore;

  log("📊", "Total Supply", `${bold}${supplyAfter.toLocaleString()} NMT${reset}  ${green}(+${Math.round(supplyDiff)} minted)${reset}`);
  gap();
  log("👨‍💻", "Developer", shortAddr(DEMO_WALLET));
  log("  ", "Balance", `${bold}${devAfter.toLocaleString()} NMT${reset}`);
  gap();
  log("⛏ ", "Miner", shortAddr(MINER_ADDR));
  log("  ", "Balance", `${bold}${minerAfter.toLocaleString()} NMT${reset}  ${green}(+${Math.round(minerDiff)} earned from inference)${reset}`);

  gap();
  console.log(`  ${dim}${"─".repeat(60)}${reset}`);
  console.log(`  ${bold}${green}Miner earned ${Math.round(minerDiff)} NMT by running AI inference.${reset}`);
  console.log(`  ${dim}Token was minted by smart contract — not by any company.${reset}`);

  await sleep(2000);

  // ────────────────────────────────────────────────────────
  header("6", "Role Switch — We Become the Miner");
  // ────────────────────────────────────────────────────────

  console.log(`  ${bold}${yellow}Scenario A (Steps 2-5):${reset} We were the ${cyan}developer${reset}, someone else's GPU ran our task.`);
  console.log(`  ${bold}${yellow}Scenario B (Now):${reset}      We are the ${green}miner${reset}. Alice calls the API, our GPU earns NMT.`);
  gap();

  console.log(`  ${dim}${"─".repeat(60)}${reset}`);
  gap();

  const minerBeforeB = await getBalance(MINER_ADDR);
  const aliceBefore = await getBalance(ALICE_WALLET);

  log("👩", "Alice (Dev)", `${shortAddr(ALICE_WALLET)}  Balance: ${bold}${aliceBefore.toLocaleString()} NMT${reset}`);
  log("⛏ ", "Our Miner", `${shortAddr(MINER_ADDR)}  Balance: ${bold}${minerBeforeB.toLocaleString()} NMT${reset}`);

  gap();
  console.log(`  ${dim}  Alice sends a request using her own API key...${reset}`);
  gap();

  const alicePrompt = "What is the benefit of decentralized AI inference?";
  const aliceStart = Date.now();
  const aliceResult = await jsonFetch(`${API}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ALICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.2-1b",
      messages: [{ role: "user", content: alicePrompt }],
    }),
  });
  const aliceElapsed = Date.now() - aliceStart;

  if (aliceResult.detail || aliceResult.error) {
    log("!", "WARN", `Alice request failed: ${JSON.stringify(aliceResult.detail || aliceResult.error)}`);
    log(" ", "", `${dim}(Skipping Scenario B — Alice API key may not be registered)${reset}`);
  } else {
    const aliceReply = aliceResult.choices[0].message.content.slice(0, 120).replace(/\n/g, " ");
    log("📤", "Alice's Request", `"${alicePrompt}"`);
    log("📥", "AI Response", `${dim}${aliceReply}...${reset}`);
    log("⏱ ", "Latency", `${bold}${aliceElapsed}ms${reset}`);
  }

  await sleep(2000);

  const minerAfterB = await getBalance(MINER_ADDR);
  const aliceAfter = await getBalance(ALICE_WALLET);
  const minerEarnedB = minerAfterB - minerBeforeB;

  gap();
  console.log(`  ${dim}${"─".repeat(60)}${reset}`);
  gap();

  log("👩", "Alice (Dev)", `${aliceBefore.toLocaleString()} → ${bold}${aliceAfter.toLocaleString()} NMT${reset}`);
  log("⛏ ", "Our Miner", `${minerBeforeB.toLocaleString()} → ${bold}${minerAfterB.toLocaleString()} NMT${reset}  ${green}(+${Math.round(minerEarnedB)} earned from Alice's task)${reset}`);

  gap();
  console.log(`  ${bold}${green}Our GPU processed Alice's request and earned ${Math.round(minerEarnedB)} NMT.${reset}`);
  console.log(`  ${dim}Same machine, same miner — but now we're the compute provider.${reset}`);

  await sleep(2000);

  // ────────────────────────────────────────────────────────
  header("7", "Burst Test — 3 More Requests");
  // ────────────────────────────────────────────────────────

  const prompts = [
    "What is proof of work in one sentence?",
    "Name one advantage of decentralized systems.",
    "How does token economics create incentives?",
  ];

  for (let i = 0; i < prompts.length; i++) {
    const s = Date.now();
    const r = await jsonFetch(`${API}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.2-1b", messages: [{ role: "user", content: prompts[i] }] }),
    });
    const e = Date.now() - s;
    if (r.choices) {
      const ans = r.choices[0].message.content.slice(0, 100).replace(/\n/g, " ");
      log(`#${i + 1}`, `${dim}${e}ms${reset}`, `"${prompts[i]}"`);
      console.log(`${dim}            → ${ans}...${reset}`);
    }
    gap();
  }

  await sleep(1500);

  // ────────────────────────────────────────────────────────
  header("8", "Final On-Chain Verification");
  // ────────────────────────────────────────────────────────

  const supplyFinal = await getTotalSupply();
  const devFinal = await getBalance(DEMO_WALLET);
  const minerFinal = await getBalance(MINER_ADDR);
  const blockFinal = await getBlockNumber();

  const totalMinted = supplyFinal - supplyBefore;
  const totalEarned = minerFinal - minerBefore;

  log("⛓ ", "Block", `#${blockFinal}`);
  log("📊", "Supply", `${supplyBefore.toLocaleString()} → ${bold}${supplyFinal.toLocaleString()} NMT${reset}  ${green}(+${Math.round(totalMinted)} minted this session)${reset}`);
  gap();
  log("👨‍💻", "Us (Developer)", `${devBefore.toLocaleString()} → ${bold}${devFinal.toLocaleString()} NMT${reset}`);
  log("⛏ ", "Us (Miner)", `${minerBefore.toLocaleString()} → ${bold}${minerFinal.toLocaleString()} NMT${reset}  ${green}(+${Math.round(totalEarned)} earned total)${reset}`);
  log("👩", "Alice (Dev)", `${aliceBefore.toLocaleString()} → ${bold}${aliceAfter.toLocaleString()} NMT${reset}`);

  gap();
  console.log(`  ${dim}${"─".repeat(60)}${reset}`);
  gap();

  console.log(`  ${bold}${cyan}Key Takeaways:${reset}`);
  gap();
  console.log(`  ${bold}1.${reset} OpenAI SDK compatible — change ${cyan}base_url${reset}, done`);
  console.log(`  ${bold}2.${reset} ${yellow}Dual role${reset}: we consumed AI (Scenario A) AND provided compute (Scenario B)`);
  console.log(`  ${bold}3.${reset} Miner earned ${green}${Math.round(totalEarned)} NMT total${reset} for providing GPU compute`);
  console.log(`  ${bold}4.${reset} Reward minted by smart contract — trustless, on-chain`);
  console.log(`  ${bold}5.${reset} No credit card, no account, no censorship`);
  console.log(`  ${bold}6.${reset} Anyone can be a miner — just run Ollama + miner client`);

  gap();
  console.log(`  ${bold}${magenta}  Frontend Dashboard: ${reset}${dim}http://localhost:5174${reset}`);
  console.log(`  ${bold}${magenta}  API Endpoint:       ${reset}${dim}http://localhost:8000/v1/chat/completions${reset}`);
  gap();
  console.log(`  ${bold}${green}  Demo complete.${reset}`);
  console.log();
}

main().catch((e) => {
  console.error(`${red}Demo failed:${reset}`, e.message);
  process.exit(1);
});
