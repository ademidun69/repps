# X Post Copy — ReppS (for OKX.AI Hackathon)

> Pick the version you like. Or combine. Just make sure the **demo video is attached** to the post (not a separate link).

---

## Version 1 — Punchy / direct

```
🦂 ReppS is live on the OKX.AI marketplace.

The devil's advocate your agent calls *before* it acts.

Swap $10K into a meme with 12% slippage? ReppS says ABORT.
Send a DM that matches a scam pattern? ReppS says ABORT.
Hire an unverified agent? ReppS says REVIEW.

⚖️ Adversarial review via x402 v2
💰 0.01 USDT/call on X Layer
🆓 Free tier: 3 checks/day, no signup
📋 Audit-ready output (SOC2-lite)

Try it → https://repps.onrender.com/demo

Built for #OKXAI Genesis Hackathon. by @networkbike
```

---

## Version 2 — Story-led

```
Your AI agent just got told "ape into the new meme."

Most agents would do it. $10K into a $8K pool. 12% slippage. Bye money.

ReppS is the pre-flight check that pushes back.

POST your planned action → get a verdict (PROCEED/REVIEW/ABORT), confidence score, edge cases you missed, and the questions you should've asked.

Pay per call via x402 on X Layer. 0.01 USDT.
Free tier: 3/day. No signup.

Live demo → https://repps.onrender.com

#OKXAI #x402
```

---

## Version 3 — Technical credibility

```
We just shipped ReppS to the OKX.AI marketplace.

→ x402 v2 compliant (network eip155:196, USDT0)
→ 4 services: quick_check (free), challenge ($0.01), bundle ($0.05), audit ($0.02)
→ Rule engine + LLM adversarial reasoning
→ Audit-ready structured output
→ Live in <2s

Every other agent service *does* work. ReppS *checks* work.

It's the meta-layer the agent economy is missing.

https://repps.onrender.com

#OKXAI
```

---

## Reply thread (use after main post)

**Reply 1 (technical)**
```
x402 v2 challenge format (returns 402 + base64 PAYMENT-REQUIRED header):

{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:196",
    "amount": "10000",
    "asset": "USDT0",
    "payTo": "0x...",
    "maxTimeoutSeconds": 300
  }]
}
```

**Reply 2 (use case)**
```
Real example. Agent wants to swap $10K MEME with 12% slippage, $8K pool.

ReppS returns:
  verdict: REVIEW
  confidence: 0.85
  top risk: "Trade is 125% of pool. 12% slippage is bait."
  questions: ["Did user mean 'ape' literally?", "Exit strategy?"]
```

**Reply 3 (pricing)**
```
Free: 3 quick checks/day
$0.01: full challenge
$0.05: 5-challenge bundle (50% off)
$0.02: audit log format

Agents hire agents for sub-cent work. x402 makes this economically possible.
```

---

## Posting checklist

- [ ] Demo video attached (recorded per DEMO-SCRIPT.md)
- [ ] One of the three post versions used
- [ ] Hashtag **#OKXAI** included
- [ ] Link to https://repps.onrender.com included
- [ ] Post URL copied for the Google form
