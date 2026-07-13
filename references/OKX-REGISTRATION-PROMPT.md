# OKX.AI ASP Registration — Step by Step

> **What you do (the user)**: open the page, paste the prompts below, copy the verification code from email back to me. That's it.

## Step 1: Open the registration page

Go to: **https://okx.ai/tutorial/asp**

If you don't have an OKX Agentic Wallet account, click "Sign Up" and create one with your email. Verify the email.

## Step 2: Send these prompts to the Onchain OS agent

Once you're signed in, the page has a "Send to your Agent" pattern. Use Claude Code, Codex, Hermes, OpenClaw, or any MCP-compatible client. The prompts are:

### Prompt 1 — Register identity
```
Help me register an A2MCP ASP on OKX.AI using Onchain OS.
Service name: ReppS
Tagline: The devil's advocate your agent calls before it acts.
Description: ReppS is an adversarial review service for AI agents. Before an agent swaps, sends, hires, deploys, or commits to any non-trivial action, it calls ReppS. ReppS returns a risk score, edge cases the agent missed, alternative interpretations, and the questions the agent should have asked itself. Built for the OKX.AI Genesis Hackathon 2026.
Category: Software Utility
Receive address: <paste your X Layer wallet here>
Pricing: 0.01 USDT per challenge, 0.05 USDT per bundle, 0.02 USDT per audit, free quick check
```

### Prompt 2 — Fill service list
```
For ReppS ASP, register 4 services:
1. quick_check: POST /api/quick_check — free (3/day per IP)
2. challenge: POST /api/challenge — 0.01 USDT per call (amount 10000 in 6 decimals)
3. bundle_5: POST /api/bundle — 0.05 USDT per bundle (amount 50000 in 6 decimals)
4. audit_log: POST /api/audit — 0.02 USDT per log (amount 20000 in 6 decimals)
All on X Layer (eip155:196), asset USDT0, scheme exact, max timeout 300s.
```

### Prompt 3 — Submit for review
```
Help me list my ReppS ASP on OKX.AI using Onchain OS.
Review should complete in 24 hours. Send result to my registered email.
```

## Step 3: Wait for review

Review takes 24h to 2 business days. You'll get an email when it's done.

## Step 4: Forward the email to me

When you get the review result email (approval or rejection):
- **If approved**: forward me the email. I'll mark the listing as live and we move to X post + Google form.
- **If rejected**: forward me the rejection reason. I'll fix the issues, update the code, and we resubmit.

## If the Onchain OS skill needs a code

If any step asks for a verification code, copy the code from your email and paste it back to me. I'll integrate it into the next step automatically.

---

## Quick reference

| Field | Value |
|---|---|
| Service URL | `https://repps.onrender.com` |
| Manifest URL | `https://repps.onrender.com/.well-known/x402` |
| Health check | `https://repps.onrender.com/health` |
| Network | eip155:196 (X Layer) |
| Asset | USDT0 |
| Pricing | 0.01 / 0.05 / 0.02 USDT + free |
| Repo | `https://github.com/ademidun69/repps` |
