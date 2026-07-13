# ReppS Demo Recording Script (90 seconds)

> Record on phone. Vertical or horizontal, your call. Embed in X post (not separate upload).

## Setup (before recording)

1. Open phone browser → `https://repps.onrender.com/demo`
2. Have the page loaded with the default "Memecoin ape" scenario selected
3. Optional: open `https://repps.onrender.com` in another tab to show the landing page

## Script (~85 seconds)

### Beat 1 (0–10s) — Hook
**On screen**: landing page hero
**Voiceover / caption**:
> "Your AI agent wants to swap $10K into a meme coin. 12% slippage. $8K pool. No questions asked."

### Beat 2 (10–20s) — Show the problem
**On screen**: switch to /demo, show the JSON
**Caption**:
> "Most agents would just do it. 57% of enterprises have watched agents be confidently wrong."

### Beat 3 (20–35s) — Call ReppS
**On screen**: hit "Run ReppS (free) ⚖️"
**Wait** for the result
**Caption**:
> "So before it acts, the agent calls ReppS — the devil's advocate."

### Beat 4 (35–55s) — Show the verdict
**On screen**: REVIEW/ABORT tag in red, top risk visible
**Caption**:
> "ReppS says: REVIEW. 'Trade size is 125% of pool liquidity. Slippage tolerance 12% is front-runner bait. Did the user mean ape literally? What's the exit strategy?'"

### Beat 5 (55–70s) — Show the x402 payment flow
**On screen**: open terminal / Termux, run:
```bash
curl -i -X POST https://repps.onrender.com/api/challenge \
  -H "Content-Type: application/json" \
  -d '{"action_type":"swap","params":{"token_out":"MEME","slippage_pct":12,"pool_liquidity_usd":8000,"amount":"10000"},"context":{"agent_id":"demo"}}'
```
**Show**: HTTP 402 response with the `PAYMENT-REQUIRED` header (base64)
**Caption**:
> "x402 v2 payment on X Layer. 0.01 USDT per review. No accounts, no API keys."

### Beat 6 (70–85s) — The wider pitch
**On screen**: back to landing page, scroll to "Pricing" section showing the 4 tools
**Caption**:
> "ReppS works for any action: swap, send, hire, deploy, message. Pay per call. Audit-ready output. Built for the OKX.AI marketplace."

### End card (85–90s)
**On screen**: 
- Logo + URL
- "Try it free: repps.onrender.com/demo"
- "#OKXAI"

---

## Recording tips

- **Voiceover optional** — captions work fine
- **Use screen-record on Android** (built-in) or iOS (built-in)
- **Vertical** is fine for X / TikTok
- **Max 90 seconds** — trim if over
- **Don't show personal info** — no email, no wallet, no Telegram

## After recording

1. Save the video to your phone
2. Upload directly when posting to X (Twitter now supports in-line video in posts)
3. Use the prepared caption from `X-POST-COPY.md`
4. Add hashtags: **#OKXAI** + #AIagents #x402 (optional)
