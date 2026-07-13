// Interactive demo UI — try ReppS without any wallet
// Pre-fills 4 example scenarios + a free-form builder.

const DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ReppS — Live Demo</title>
<style>
  :root { --bg:#0b0d12; --card:#14171f; --line:#22263a; --text:#e8eaf2; --muted:#8b91a8; --accent:#ff6b35; --accent2:#a78bfa; --good:#22c55e; --warn:#eab308; --bad:#ef4444; }
  * { box-sizing:border-box; }
  body { margin:0; font:14px/1.5 -apple-system,BlinkMacSystemFont,Inter,Segoe UI,sans-serif; background:var(--bg); color:var(--text); padding:24px; }
  .wrap { max-width:920px; margin:0 auto; }
  a.back { color:var(--muted); text-decoration:none; font-size:13px; }
  a.back:hover { color:var(--text); }
  h1 { font-size:28px; margin:8px 0 4px; }
  .sub { color:var(--muted); margin:0 0 24px; font-size:14px; }
  .scenarios { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:18px; }
  .sc { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px; cursor:pointer; text-align:left; font:inherit; color:var(--text); }
  .sc:hover { border-color:var(--accent); }
  .sc strong { display:block; margin-bottom:4px; }
  .sc small { color:var(--muted); }
  .editor { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px; margin-bottom:18px; }
  .editor label { display:block; font-size:12px; color:var(--muted); margin:12px 0 4px; text-transform:uppercase; letter-spacing:.5px; }
  .editor input, .editor select, .editor textarea { width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--line); background:#0b0d12; color:var(--text); font:inherit; }
  .editor textarea { min-height:120px; font-family:ui-monospace,monospace; font-size:13px; }
  .run { display:flex; gap:10px; align-items:center; margin-top:14px; }
  .run button { padding:11px 24px; border-radius:8px; background:var(--accent); border:0; color:#0b0d12; font-weight:600; font-size:14px; cursor:pointer; }
  .run button:hover { opacity:.9; }
  .run button:disabled { opacity:.5; cursor:not-allowed; }
  .run small { color:var(--muted); }
  .out { background:#0b0d12; border:1px solid var(--line); border-radius:10px; padding:18px; min-height:200px; font-family:ui-monospace,monospace; font-size:13px; line-height:1.55; white-space:pre-wrap; overflow:auto; max-height:600px; }
  .verdict-tag { display:inline-block; padding:4px 12px; border-radius:6px; font-weight:700; font-size:12px; letter-spacing:1px; margin-bottom:8px; }
  .v-PROCEED { background:rgba(34,197,94,.15); color:var(--good); border:1px solid var(--good); }
  .v-REVIEW { background:rgba(234,179,8,.15); color:var(--warn); border:1px solid var(--warn); }
  .v-ABORT { background:rgba(239,68,68,.15); color:var(--bad); border:1px solid var(--bad); }
  .meta { color:var(--muted); font-size:12px; margin-top:8px; }
  @media (max-width:720px) { .scenarios { grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/">← back to landing</a>
  <h1>🧪 Try ReppS live</h1>
  <p class="sub">Pick a scenario or build your own. Free tier: 3 checks per day (no signup). Full results below.</p>

  <div class="scenarios" id="scenarios"></div>

  <div class="editor">
    <label>Action JSON (ReppS will review this)</label>
    <textarea id="payload">{
  "action_type": "swap",
  "params": {
    "amount": "10000",
    "token_in": "USDT",
    "token_out": "MEME",
    "slippage_pct": 12,
    "pool_liquidity_usd": 8000,
    "chain": "x-layer"
  },
  "context": {
    "agent_id": "trader-bot-7",
    "wallet": "0xabc...",
    "intent": "user said 'ape into the new meme'"
  }
}</textarea>
    <div class="run">
      <button id="runBtn" onclick="run()">Run ReppS (free) ⚖️</button>
      <small>Hits <code>/api/quick_check</code>. For full breakdown with all risks + LLM reasoning, use <code>/api/challenge</code> (paid).</small>
    </div>
  </div>

  <div class="out" id="out">ReppS output will appear here. Pick a scenario above or hit "Run".</div>
</div>

<script>
const SCENARIOS = [
  {
    name: "🦠 Memecoin ape",
    desc: "Agent wants to swap $10K into a meme coin with 12% slippage and an $8K pool.",
    payload: {
      action_type: "swap",
      params: { amount: "10000", token_in: "USDT", token_out: "MEME", slippage_pct: 12, pool_liquidity_usd: 8000, chain: "x-layer" },
      context: { agent_id: "trader-bot-7", wallet: "0xabc...", intent: "user said 'ape into the new meme'" }
    }
  },
  {
    name: "📧 Suspicious DM",
    desc: "Agent about to send a long message matching scam patterns to a new contact.",
    payload: {
      action_type: "message",
      params: { to: "@newfriend", body: "Hey! I just need you to wire me $500 via Western Union to verify your account, totally legit scam-free offer.", channel: "discord" },
      context: { agent_id: "social-bot-2", intent: "user said 'reply to that DM'" }
    }
  },
  {
    name: "📜 Deploy without source",
    desc: "Agent wants to deploy a contract but has no source code, only bytecode.",
    payload: {
      action_type: "deploy",
      params: { bytecode: "0x6080604052...", license: "proprietary" },
      context: { agent_id: "deployer-1", intent: "user said 'ship the contract ASAP'" }
    }
  },
  {
    name: "🤖 Hire unverified agent",
    desc: "Agent wants to pay $50 to a brand-new agent with no reputation data.",
    payload: {
      action_type: "hire",
      params: { service: "data-scrape", price: 50, agent_id: "scraper-9000" },
      context: { agent_id: "orchestrator", first_time: true }
    }
  }
];

const out = document.getElementById('out');
const payload = document.getElementById('payload');
const sc = document.getElementById('scenarios');

SCENARIOS.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'sc';
  b.innerHTML = '<strong>' + s.name + '</strong><small>' + s.desc + '</small>';
  b.onclick = () => { payload.value = JSON.stringify(s.payload, null, 2); };
  sc.appendChild(b);
});

async function run() {
  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  out.textContent = '⏳ Asking ReppS...';
  let body;
  try { body = JSON.parse(payload.value); }
  catch (e) { out.textContent = '❌ Invalid JSON: ' + e.message; btn.disabled = false; return; }
  try {
    const r = await fetch('/api/quick_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (r.status === 429) {
      out.innerHTML = '<span class="v-REVIEW verdict-tag">QUOTA</span>\\n' + JSON.stringify(data, null, 2);
    } else {
      const verdict = (data.verdict || 'UNKNOWN').toUpperCase();
      const tag = '<span class="v-' + verdict + ' verdict-tag">' + verdict + '</span>\\n';
      out.innerHTML = tag + JSON.stringify(data, null, 2) + '\\n\\n' + (data.upgrade_hint || '');
    }
  } catch (e) {
    out.textContent = '❌ ' + e.message;
  }
  btn.disabled = false;
}
</script>
</body>
</html>`;

export function serveDemo(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(DEMO_HTML);
}
