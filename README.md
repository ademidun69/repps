# ReppS — Adversarial Cognitive Layer for AI Agents

> **The devil's advocate your agent calls before it acts.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![x402 v2](https://img.shields.io/badge/x402-v2-ff6b35.svg)](https://x402.org)
[![X Layer](https://img.shields.io/badge/network-eip155:196-a78bfa.svg)](https://www.okx.com/xlayer)
[![OKX.AI Hackathon 2026](https://img.shields.io/badge/OKX.AI-Genesis_Hackathon_2026-22c55e.svg)](https://hackquest.io/hackathons/OKXAI-Genesis-Hackathon)
[![Node 18+](https://img.shields.io/badge/node-18%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blueviolet.svg)](#architecture)

ReppS is an **Agent Service Provider (ASP)** on the OKX.AI marketplace. It's an adversarial review service that AI agents call *before* they execute any non-trivial action — swapping tokens, sending messages, hiring other agents, deploying contracts, transferring funds.

ReppS returns a risk score, edge cases the agent missed, alternative interpretations, and the questions the agent should have asked itself. It's deliberately disagreeable.

Built for the [OKX.AI Genesis Hackathon](https://hackquest.io/hackathons/OKXAI-Genesis-Hackathon) (Jul 3–17, 2026 · $100K prize pool).

---

## Why this exists

The 50 launch ASPs on OKX.AI are all **action-oriented** — they do work. None of them **check work**. That's the gap.

- 57% of enterprises have watched AI agents be *confidently wrong* (VentureBeat, 2026)
- 78% of AI agent pilots fail in production (DigitalOcean, Mar 2026)
- 95% of AI spending has not produced measurable business returns (MIT, 2025)

The missing piece isn't more capability. It's a **pre-flight review** that pushes back on the agent's plan before it commits.

## How an agent calls ReppS

```bash
# 1) Agent sends a planned action, no payment header
curl -X POST https://repps.xyz/api/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "action_type": "swap",
    "params": { "amount": "10000", "token_out": "MEME", "slippage_pct": 12, "pool_liquidity_usd": 8000 },
    "context": { "agent_id": "trader-bot-7", "intent": "user said ape into the new meme" }
  }'

# 2) Server returns HTTP 402 with x402 v2 challenge
#    PAYMENT-REQUIRED: <base64({x402Version:2, accepts:[{scheme:exact, network:eip155:196, amount:10000, payTo:0x..., asset:USDT0}]})>

# 3) Agent pays 0.01 USDT on X Layer, replays with PAYMENT-SIGNATURE header

# 4) Server returns 200 with the full review
{
  "verdict": "ABORT",
  "confidence": 0.92,
  "score": 85,
  "risks": [
    "Slippage tolerance 12% is dangerously high. Front-runner bait.",
    "Trade size is 125% of pool liquidity. Expect massive price impact."
  ],
  "alternatives": ["Use a DEX aggregator", "Split into smaller trades"],
  "adversarial_questions": ["Did the user mean ape literally?", "What is the exit strategy?"],
  "reasoning": "...",
  "check_id": "uuid"
}
```

## Services & pricing

| Service | Price | x402 amount | What it does |
|---|---|---|---|
| `/api/quick_check` | Free (3/day/IP) | 0 | Fast heuristic verdict + top risk |
| `/api/challenge` | $0.01/call | `10000` | Full adversarial review |
| `/api/bundle` | $0.05/bundle | `50000` | 5 challenge calls (50% off) |
| `/api/audit` | $0.02/log | `20000` | Audit-ready log of past checks |

All payments in **USDT0 (USD₮0)** on **X Layer mainnet** (CAIP-2 `eip155:196`).

## Endpoints

```
GET  /                        → landing page
GET  /demo                    → interactive demo (no signup)
GET  /.well-known/x402        → x402 v2 service manifest
GET  /health                  → liveness + config
POST /api/quick_check         → free (3/day/IP)
POST /api/challenge           → $0.01 USDT · full review
POST /api/bundle              → $0.05 USDT · 5 framings
POST /api/audit               → $0.02 USDT · audit log
```

## Run locally

```bash
git clone https://github.com/ademidun69/repps
cd repps
node src/server.js
# → listening on :10000
```

Optional env vars:
- `RECEIVE_ADDRESS` — your X Layer wallet (defaults to test address)
- `OPENAI_API_KEY` — enables LLM upgrade mode (deep adversarial reasoning)
- `REPPS_TEST=1` — disables free-tier quota (for testing)

## Architecture

```
src/
├── server.js       # Express-style http server, route dispatch, CORS
├── landing.js      # Marketing landing page
├── demo.js         # Interactive demo UI (4 scenarios + freeform)
├── x402.js         # x402 v2 challenge generation + receipt verification
├── routes.js       # Endpoint handlers (challenge/quick_check/bundle/audit)
└── adversarial.js  # Rule engine + optional LLM upgrade + merger
```

**Two-layer review:**
1. **Rule engine** (always runs, zero deps) — checks structured risks: burn addresses, slippage, honeypot patterns, unaudited contracts, scam messages, etc.
2. **LLM upgrade** (optional, needs `OPENAI_API_KEY`) — adds free-form adversarial reasoning: "What could go wrong? What did the agent assume? What did the user really mean?"

The result merges both: takes the more conservative verdict, unions all risks.

## License

MIT — Ademidun (ademidun69)

## Links

- Live: `https://repps.xyz`
- Repo: `https://github.com/ademidun69/repps`
- OKX.AI: `https://okx.ai/tutorial/asp`
- Hackathon: `https://hackquest.io/hackathons/OKXAI-Genesis-Hackathon`
