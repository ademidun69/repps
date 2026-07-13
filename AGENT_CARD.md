# ReppS — Agent Card

> **Paste these fields directly into the OKX.AI ASP registration form at `okx.ai/tutorial/asp`.**

---

## Service Identity

| Field | Value |
|---|---|
| **Service name** | `ReppS` |
| **Tagline** | The devil's advocate your agent calls before it acts. |
| **Service description** | ReppS is an adversarial review service for AI agents. Before an agent swaps, sends, hires, deploys, or commits to any non-trivial action, it calls ReppS. ReppS returns a risk score, edge cases the agent missed, alternative interpretations, and the questions the agent should have asked itself. Built for the OKX.AI Genesis Hackathon. |
| **Category** | Software Utility (primary), Best Product (secondary), Social Buzz (secondary) |
| **Service URL** | `https://repps.onrender.com` |
| **Manifest** | `https://repps.onrender.com/.well-known/x402` |
| **Repo** | `https://github.com/ademidun69/repps` |

## Vendor

| Field | Value |
|---|---|
| **Name** | O.A Dolapo |
| **GitHub** | `ademidun69` |
| **Contact** | via GitHub issues |

## Service List (tools exposed)

| # | Tool | Endpoint | Price | x402 amount | Description |
|---|---|---|---|---|---|
| 1 | `quick_check` | `POST /api/quick_check` | Free (3/day/IP) | 0 | Fast heuristic verdict + top risk |
| 2 | `challenge` | `POST /api/challenge` | $0.01 USDT/call | `10000` | Full adversarial review (all risks, alternatives, questions, reasoning) |
| 3 | `bundle_5` | `POST /api/bundle` | $0.05 USDT/bundle | `50000` | 5 challenge calls bundled, 50% off |
| 4 | `audit_log` | `POST /api/audit` | $0.02 USDT/log | `20000` | Audit-ready log of past checks (SOC2-lite format) |

## x402 v2 Configuration

| Field | Value |
|---|---|
| **Network** | `eip155:196` (X Layer mainnet) |
| **Asset** | `USDT0` (USD₮0) |
| **Scheme** | `exact` |
| **Decimals** | 6 |
| **Receive address** | (set via `RECEIVE_ADDRESS` env var on Render — your X Layer wallet) |
| **Max timeout** | 300 seconds |
| **Standard** | x402 v2 (Coinbase / Cloudflare / Linux Foundation) |

## Pricing rationale

- **Free tier** exists for reviewability and traction. Reviewer and early agents can test without a wallet.
- **$0.01 per call** is the cost of a single transaction on X Layer; aligns with the "agents hire agents for sub-cent work" pattern.
- **Bundle at $0.05** = 5 calls for the price of ~3 (50% off). Targets agents that batch-review.
- **Audit at $0.02** = ~2x the cost of a single check. Targets compliance teams that batch-format logs.

## Use case examples

1. **DeFi trading agent** — calls ReppS before swapping. Gets ABORT on high-slippage/illiquid pools. Saves $10K.
2. **Social media agent** — calls ReppS before sending a DM. Gets ABORT on scam-pattern match. Avoids compliance violation.
3. **Deployer agent** — calls ReppS before deploying unaudited contract. Gets REVIEW/ABORT, adds source + audit before shipping.
4. **Orchestrator agent** — calls ReppS before hiring a new sub-agent. Gets REVIEW on no reputation data, requests verification first.
5. **Compliance team** — calls ReppS at end of week to format past 100 challenges into an audit log for regulators.

## Why ReppS is unique

- **First-mover in adversarial pre-flight review on x402.** No other ASP does this.
- **Designed to be disagreeable.** Most agent services are yes-men. ReppS assumes the agent is wrong.
- **Two-layer architecture** = works without LLM (rule engine), upgrades with one. No single point of failure.
- **Real demand signal.** 57% of enterprises have watched agents be confidently wrong. ReppS is the structural fix.
- **Auditable.** Every check has an ID, a timestamp, and a citable result. Compliance teams love this.

## How to test (for OKX reviewers)

```bash
# Free tier — works without payment
curl -X POST https://repps.onrender.com/api/quick_check \
  -H "Content-Type: application/json" \
  -d '{"action_type":"swap","params":{"token_out":"MEME","slippage_pct":12,"pool_liquidity_usd":8000,"amount":"10000"},"context":{"agent_id":"reviewer-test"}}'

# Manifest
curl https://repps.onrender.com/.well-known/x402

# Health
curl https://repps.onrender.com/health
```

## Live artifacts

| Artifact | URL |
|---|---|
| Live demo | `https://repps.onrender.com` |
| Interactive demo | `https://repps.onrender.com/demo` |
| x402 manifest | `https://repps.onrender.com/.well-known/x402` |
| Source code | `https://github.com/ademidun69/repps` |
| README | `https://github.com/ademidun69/repps#readme` |
| Demo video (X post) | (link added after recording) |

## Compliance

- Pure software ASP, no KYC/AML implications
- Does not handle user funds; only receives USDT0 payments via x402 standard
- All input is treated as untrusted; rule engine is deterministic and auditable
- No PII stored; logs are in-memory only and reset on restart
