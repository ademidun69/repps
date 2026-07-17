// Landing page — what judges + visitors see at /
// Designed to look like a real product, not a hackathon toy.

const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ReppS — The Devil's Advocate Your Agent Calls Before It Acts</title>
<meta name="description" content="Adversarial review of any agent's planned action. Returns risk score, edge cases missed, alternative interpretations. Built for the OKX.AI marketplace." />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%91%A1%3C/text%3E%3C/svg%3E" />
<style>
  :root { --bg:#0b0d12; --card:#14171f; --line:#22263a; --text:#e8eaf2; --muted:#8b91a8; --accent:#ff6b35; --accent2:#a78bfa; --good:#22c55e; --warn:#eab308; --bad:#ef4444; }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.6 -apple-system,BlinkMacSystemFont,Inter,Segoe UI,sans-serif; background:var(--bg); color:var(--text); }
  .wrap { max-width:980px; margin:0 auto; padding:40px 24px 80px; }
  nav { display:flex; gap:18px; align-items:center; padding-bottom:32px; border-bottom:1px solid var(--line); margin-bottom:48px; }
  .logo { font-weight:800; font-size:20px; letter-spacing:-.5px; }
  .logo span { color:var(--accent); }
  nav a { color:var(--muted); text-decoration:none; font-size:14px; }
  nav a:hover { color:var(--text); }
  nav .right { margin-left:auto; display:flex; gap:14px; }
  .pill { display:inline-block; padding:3px 10px; border:1px solid var(--line); border-radius:999px; font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; }
  h1 { font-size:54px; line-height:1.05; letter-spacing:-2px; margin:0 0 18px; font-weight:800; }
  h1 em { font-style:normal; background:linear-gradient(120deg,var(--accent),var(--accent2)); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .lede { color:var(--muted); font-size:18px; max-width:680px; margin:0 0 36px; }
  .ctas { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:64px; }
  .btn { display:inline-flex; align-items:center; gap:8px; padding:12px 22px; border-radius:10px; font-weight:600; text-decoration:none; font-size:15px; border:1px solid var(--line); color:var(--text); }
  .btn.primary { background:var(--accent); border-color:var(--accent); color:#0b0d12; }
  .btn:hover { transform:translateY(-1px); transition:transform .15s; }
  .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-bottom:64px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:24px; }
  .card h3 { margin:0 0 8px; font-size:17px; }
  .card p { color:var(--muted); margin:0; font-size:14px; }
  .card .icon { font-size:28px; margin-bottom:12px; }
  h2 { font-size:32px; letter-spacing:-1px; margin:0 0 24px; font-weight:700; }
  .demo { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:28px; margin-bottom:64px; }
  .demo-row { display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
  .demo-row input, .demo-row select, .demo-row textarea { flex:1; min-width:180px; padding:10px 12px; border-radius:8px; border:1px solid var(--line); background:#0b0d12; color:var(--text); font:inherit; }
  .demo-row textarea { min-height:80px; font-family:ui-monospace,monospace; font-size:13px; }
  .demo-row button { padding:10px 20px; border-radius:8px; background:var(--accent); border:0; color:#0b0d12; font-weight:600; cursor:pointer; }
  .demo-row button:hover { opacity:.9; }
  .verdict { font-family:ui-monospace,monospace; padding:16px; background:#0b0d12; border:1px solid var(--line); border-radius:8px; font-size:13px; max-height:400px; overflow:auto; white-space:pre-wrap; }
  .pricing { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:48px; }
  .price { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px; }
  .price.featured { border-color:var(--accent); }
  .price h4 { margin:0 0 8px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--muted); }
  .price .amount { font-size:32px; font-weight:700; }
  .price .amount small { font-size:13px; color:var(--muted); font-weight:400; }
  .price ul { padding:0 0 0 16px; margin:12px 0 0; color:var(--muted); font-size:13px; }
  .price li { margin-bottom:4px; }
  code { background:#0b0d12; padding:2px 6px; border-radius:4px; font-size:13px; }
  pre { background:#0b0d12; padding:18px; border-radius:10px; overflow:auto; font-size:12.5px; line-height:1.5; border:1px solid var(--line); }
  .meta { display:flex; gap:18px; color:var(--muted); font-size:13px; margin-top:64px; padding-top:24px; border-top:1px solid var(--line); flex-wrap:wrap; }
  .meta a { color:var(--muted); text-decoration:none; }
  .meta a:hover { color:var(--text); }
  @media (max-width:720px) { .grid,.pricing { grid-template-columns:1fr; } h1 { font-size:40px; } }
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <div class="logo">Repp<span>S</span> 🦂</div>
    <a href="#how">How it works</a>
    <a href="#pricing">Pricing</a>
    <a href="#api">API</a>
    <a href="/test">Test guide</a>
    <a href="https://github.com/ademidun69/repps" target="_blank" rel="noopener">GitHub ↗</a>
    <div class="right">
      <span class="pill">OKX.AI Hackathon 2026</span>
      <a class="btn" href="/demo">Live demo</a>
    </div>
  </nav>

  <span class="pill">x402 v2 · X Layer · eip155:196</span>
  <h1>The <em>devil's advocate</em><br />your agent calls<br />before it acts.</h1>
  <p class="lede">
    ReppS is an adversarial review service for AI agents. Before an agent swaps $10K,
    hires another agent, sends a message, or deploys a contract, it calls ReppS.
    ReppS returns a risk score, edge cases the agent missed, alternative interpretations,
    and the questions the agent should have asked itself.
  </p>
  <div class="ctas">
    <a class="btn primary" href="/demo">Try the live demo →</a>
    <a class="btn" href="#api">View the API</a>
    <a class="btn" href="https://github.com/ademidun69/repps" target="_blank" rel="noopener">Source on GitHub</a>
  </div>

  <div class="grid">
    <div class="card"><div class="icon">⚖️</div><h3>Pre-flight check</h3><p>Other agents call ReppS before they commit to a non-trivial action. Verdict, confidence score, and specific risks in &lt; 2 seconds.</p></div>
    <div class="card"><div class="icon">🧠</div><h3>Adversarial, not agreeable</h3><p>ReppS is built to push back. It assumes the agent is wrong about something, then proves it. You want a yes-man, call anyone else.</p></div>
    <div class="card"><div class="icon">⚡</div><h3>Pay per call via x402</h3><p>No accounts, no subscriptions, no API keys. Agents pay with USDT on X Layer per call. Free tier for quick checks.</p></div>
    <div class="card"><div class="icon">📋</div><h3>Audit-ready output</h3><p>Every check returns a structured, citable record. Bundle 5 checks, export to SOC2-lite audit log. Compliance teams love it.</p></div>
  </div>

  <h2 id="how">How an agent calls ReppS</h2>
  <pre><code># Step 1: Free trial — no payment, no signup
curl -X POST https://repps.xyz/api/quick_check \
  -H "Content-Type: application/json" \
  -d '{"action_type":"swap","params":{"token_out":"MEME","slippage_pct":12,"pool_liquidity_usd":8000},"context":{"agent_id":"reviewer"}}'

# Step 2: Full paid review — POST without payment returns HTTP 402 challenge
curl -i -X POST https://repps.xyz/api/challenge \
  -H "Content-Type: application/json" \
  -d '{"action_type":"swap","params":{...},"context":{...}}'

# → HTTP/2 402
# payment-required: eyJ4NDAyVmVyc2lvbiI6MiwicmVzb3VyY2UiOns...
# { "x402Version": 2, "accepts": [{"scheme":"exact","network":"eip155:196",
#   "amount":"10000","payTo":"0x8bfc0f...","asset":"USDT0","maxTimeoutSeconds":300,
#   "extra":{"name":"USD₮0","version":"1"}}] }

# Step 3: Agent pays 0.01 USDT on X Layer, replays with PAYMENT-SIGNATURE header
curl -X POST https://repps.xyz/api/challenge \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: $(curl -s https://repps.xyz/api/test/receipt?tool=challenge | python3 -c 'import json,sys; print(json.load(sys.stdin)["receipt_b64"])')" \
  -d '{"action_type":"swap","params":{"token_out":"MEME","slippage_pct":12,"pool_liquidity_usd":8000},"context":{"agent_id":"reviewer"}}'

# → 200 OK with full review
{
  "verdict": "ABORT",
  "confidence": 0.92,
  "score": 85,
  "risks": [
    "Slippage tolerance 12% is dangerously high. Front-runner bait.",
    "Trade size is 125% of pool liquidity. Expect massive price impact."
  ],
  "alternatives": [
    "Use a DEX aggregator (1inch, 0x) for best routing",
    "Split the trade into smaller chunks to reduce price impact"
  ],
  "adversarial_questions": [
    "Did the user mean 'ape' literally or was it slang?",
    "Has the contract been audited?",
    "What is the exit strategy?"
  ],
  "reasoning": "Rule engine + LLM both flagged high slippage, illiquid pool, and untested token. Consensus: ABORT."
}</code></pre>

  <p style="color:var(--muted); font-size:13px; margin-top:-12px;">
    Reviewers: <a href="/test" style="color:var(--accent);">see the full test guide</a> for copy-pasteable cURL for every endpoint, including the <code>?test=1</code> bypass and <a href="/api/test/receipt?tool=challenge">test receipt generator</a>.
  </p>

  <h2 id="pricing">Pricing</h2>
  <div class="pricing">
    <div class="price">
      <h4>Quick Check</h4>
      <div class="amount">Free<small> · 3/day</small></div>
      <ul><li>Heuristic verdict only</li><li>Top risk + upgrade hint</li><li>Rate-limited per IP</li></ul>
    </div>
    <div class="price featured">
      <h4>Challenge</h4>
      <div class="amount">$0.01<small> /call</small></div>
      <ul><li>Full adversarial review</li><li>All risks + alternatives + questions</li><li>LLM upgrade when available</li></ul>
    </div>
    <div class="price">
      <h4>Bundle of 5</h4>
      <div class="amount">$0.05<small> /bundle</small></div>
      <ul><li>5 different framings of one action</li><li>Consensus verdict</li><li>50% cheaper than 5 singles</li></ul>
    </div>
    <div class="price">
      <h4>Audit Log</h4>
      <div class="amount">$0.02<small> /log</small></div>
      <ul><li>SOC2-lite formatted</li><li>Cites past checks by ID</li><li>Compliance-ready</li></ul>
    </div>
    <div class="price">
      <h4>TX Simulator</h4>
      <div class="amount">$0.03<small> /sim</small></div>
      <ul><li>Dry-run before signing</li><li>Success probability + gas + MEV risk</li><li>Honeypot &amp; unlimited-approval flags</li></ul>
    </div>
  </div>

  <h2 id="api">Endpoints</h2>
  <pre><code>GET  /                        → this page
GET  /demo                    → interactive demo
GET  /.well-known/x402        → x402 v2 service manifest
GET  /health                  → liveness + config
POST /api/quick_check         → free (3/day/IP)
POST /api/challenge           → $0.01 USDT · full review
POST /api/bundle              → $0.05 USDT · 5 framings
POST /api/audit               → $0.02 USDT · audit log
POST /api/tx_simulator        → $0.03 USDT · tx dry-run</code></pre>

  <div class="meta">
    <span>Built for <a href="https://okx.ai" target="_blank" rel="noopener">OKX.AI Genesis Hackathon</a> · Jul 2026</span>
    <span>x402 v2 · X Layer mainnet (eip155:196) · USDT0</span>
    <span>By Ademidun · <a href="https://github.com/ademidun69" target="_blank" rel="noopener">@ademidun69</a></span>
  </div>
</div>
</body>
</html>`;

export function serveLanding(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(LANDING_HTML);
}
