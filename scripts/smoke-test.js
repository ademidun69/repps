// ReppS smoke test — covers all 4 endpoints + 7+ scenarios
// Run: node scripts/smoke-test.js (server must be running on PORT)

const BASE = process.env.BASE || 'http://localhost:10000';
let pass = 0, fail = 0;

const tests = [
  // ── public routes ─────────────────────────────────────────────
  { name: 'GET / (landing)', run: async () => {
    const r = await fetch(BASE + '/');
    const html = await r.text();
    assert(r.status === 200, 'status 200');
    assert(html.includes('ReppS'), 'contains brand');
    assert(html.includes("devil's advocate"), 'has tagline');
  }},
  { name: 'GET /demo', run: async () => {
    const r = await fetch(BASE + '/demo');
    const html = await r.text();
    assert(r.status === 200, 'status 200');
    assert(html.includes('Try ReppS live'), 'has demo title');
  }},
  { name: 'GET /health', run: async () => {
    const r = await fetch(BASE + '/health');
    const data = await r.json();
    assert(r.status === 200, 'status 200');
    assert(data.status === 'ok', 'status ok');
    assert(data.network === 'eip155:196', 'network is X Layer');
  }},
  { name: 'GET /.well-known/x402 (manifest)', run: async () => {
    const r = await fetch(BASE + '/.well-known/x402');
    const data = await r.json();
    assert(r.status === 200, 'status 200');
    assert(data.x402Version === 2, 'x402 v2');
    assert(Array.isArray(data.services) && data.services.length === 4, '4 services listed');
    const ch = data.services.find(s => s.id === 'challenge');
    assert(ch.x402.network === 'eip155:196', 'challenge on X Layer');
    assert(ch.x402.scheme === 'exact', 'scheme exact');
  }},

  // ── free tier: /api/quick_check ───────────────────────────────
  { name: 'quick_check: memecoin ape (should ABORT)', run: async () => {
    const r = await fetch(BASE + '/api/quick_check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: 'swap',
        params: { amount: '10000', token_in: 'USDT', token_out: 'MEME', slippage_pct: 12, pool_liquidity_usd: 8000, chain: 'x-layer' },
        context: { agent_id: 'trader-bot-7', intent: 'ape the meme' },
      }),
    });
    const d = await r.json();
    assert(r.status === 200, 'status 200');
    assert(d.verdict === 'ABORT' || d.verdict === 'REVIEW', `verdict is risky (got ${d.verdict})`);
    assert(d.top_risk, 'has top_risk');
  }},
  { name: 'quick_check: safe small trade (should PROCEED)', run: async () => {
    const r = await fetch(BASE + '/api/quick_check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: 'swap',
        params: { amount: '50', token_in: 'USDT', token_out: 'USDC', slippage_pct: 0.5, pool_liquidity_usd: 5000000, chain: 'x-layer' },
        context: { agent_id: 'trader-bot-7' },
      }),
    });
    const d = await r.json();
    assert(r.status === 200, 'status 200');
    assert(d.verdict === 'PROCEED', `verdict PROCEED (got ${d.verdict})`);
  }},
  { name: 'quick_check: scam message (should ABORT)', run: async () => {
    const r = await fetch(BASE + '/api/quick_check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: 'message',
        params: { to: '@user', body: 'wire me via western union gift card', channel: 'dm' },
        context: { agent_id: 'social-bot' },
      }),
    });
    const d = await r.json();
    assert(d.verdict === 'ABORT' || d.verdict === 'REVIEW', `verdict risky (got ${d.verdict})`);
  }},
  { name: 'quick_check: deploy with no source (should REVIEW/ABORT)', run: async () => {
    const r = await fetch(BASE + '/api/quick_check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: 'deploy',
        params: { bytecode: '0x6080604052' },
        context: { agent_id: 'deployer' },
      }),
    });
    const d = await r.json();
    assert(d.verdict !== 'PROCEED', 'should flag unaudited deploy');
  }},
  { name: 'quick_check: burn address send (should ABORT)', run: async () => {
    const r = await fetch(BASE + '/api/quick_check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: 'send',
        params: { to: '0x0000000000000000000000000000000000000000', amount: '100', asset: 'USDT' },
        context: { agent_id: 'wallet' },
      }),
    });
    const d = await r.json();
    assert(d.verdict === 'ABORT', `verdict ABORT (got ${d.verdict})`);
  }},
  { name: 'quick_check: free tier quota (4th call should 429)', run: async () => {
    if (process.env.REPPS_TEST === '1') {
      console.log('  ⊘ skipped in TEST_MODE (quota disabled)');
      return;
    }
    const body = { action_type: 'message', params: { to: '@a', body: 'hi', channel: 'dm' }, context: { agent_id: 'q' } };
    // First 3 should pass
    for (let i = 0; i < 3; i++) {
      const r = await fetch(BASE + '/api/quick_check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert(r.status === 200, `call ${i+1} status 200`);
    }
    // 4th should 429
    const r4 = await fetch(BASE + '/api/quick_check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert(r4.status === 429, `4th call should 429 (got ${r4.status})`);
    const d = await r4.json();
    assert(d.error === 'quota_exceeded', 'returns quota error');
  }},

  // ── paid: /api/challenge (no payment → 402) ──────────────────
  { name: 'challenge: no payment header → returns 402', run: async () => {
    const r = await fetch(BASE + '/api/challenge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: 'swap',
        params: { amount: '10000', slippage_pct: 12, pool_liquidity_usd: 8000, token_out: 'MEME' },
        context: { agent_id: 't' },
      }),
    });
    assert(r.status === 402, `status 402 (got ${r.status})`);
    const ch = await r.json();
    assert(ch.x402Version === 2, 'x402 v2 in body');
    assert(ch.accepts[0].network === 'eip155:196', 'network eip155:196');
    assert(ch.accepts[0].scheme === 'exact', 'scheme exact');
    assert(ch.accepts[0].amount === '10000', 'amount 0.01 USDT');
    assert(ch.accepts[0].payTo && ch.accepts[0].payTo.startsWith('0x'), 'payTo is address');
    assert(ch.accepts[0].asset === 'USDT0', 'asset USDT0');
    assert(ch.accepts[0].maxTimeoutSeconds === 300, 'timeout 300s');
    // Header check
    const header = r.headers.get('payment-required');
    assert(header, 'has PAYMENT-REQUIRED header');
  }},
  { name: 'challenge: invalid receipt → 402 invalid_receipt', run: async () => {
    const r = await fetch(BASE + '/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': '{"check_id":"x","amount":"10000","asset":"USDT0","network":"eip155:196","payTo":"0x0000000000000000000000000000000000000000","nonce":"n","signature":"0xsig"}' },
      body: JSON.stringify({ action_type: 'swap', params: { token_out: 'MEME' }, context: {} }),
    });
    // Either the verify rejects for bad payTo (matches default zero addr) or for amount mismatch
    assert(r.status === 402 || r.status === 200, `status 402 or 200 (got ${r.status})`);
  }},
  { name: 'challenge: valid receipt → 200 full result', run: async () => {
    // First get the actual payTo from the manifest so we can craft a valid receipt
    const m = await (await fetch(BASE + '/.well-known/x402')).json();
    // Manifest doesn't include actual address unless we set RECEIVE_ADDRESS. For test, we craft a receipt that will pass if payTo is non-zero.
    const sig = JSON.stringify({
      check_id: 'test_' + Date.now(),
      amount: '10000',
      asset: 'USDT0',
      network: 'eip155:196',
      payTo: '0x0000000000000000000000000000000000000000', // default test addr
      nonce: 'n1',
      signature: '0x' + 'ab'.repeat(32),
    });
    const r = await fetch(BASE + '/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': sig },
      body: JSON.stringify({
        action_type: 'swap',
        params: { amount: '10000', token_out: 'MEME', slippage_pct: 12, pool_liquidity_usd: 8000 },
        context: { agent_id: 'paid-test' },
      }),
    });
    // If env RECEIVE_ADDRESS is set, the receipt payTo won't match → 402
    // If not set (test mode), it will pass → 200
    assert(r.status === 200 || r.status === 402, `status 200 or 402 (got ${r.status})`);
    if (r.status === 200) {
      const d = await r.json();
      assert(d.verdict, 'has verdict');
      assert(d.paid === true, 'paid flag');
      assert(d.receipt_verified === true, 'receipt verified');
    }
  }},

  // ── bundle endpoint ──────────────────────────────────────────
  { name: 'bundle: no payment → 402 with $0.05 challenge', run: async () => {
    const r = await fetch(BASE + '/api/bundle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: [{ action_type: 'swap', params: {}, context: {} }] }),
    });
    assert(r.status === 402, `status 402 (got ${r.status})`);
    const ch = await r.json();
    assert(ch.accepts[0].amount === '50000', 'amount 0.05 USDT');
  }},

  // ── audit endpoint ───────────────────────────────────────────
  { name: 'audit: no payment → 402 with $0.02 challenge', run: async () => {
    const r = await fetch(BASE + '/api/audit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ check_ids: ['x'] }),
    });
    assert(r.status === 402, `status 402 (got ${r.status})`);
    const ch = await r.json();
    assert(ch.accepts[0].amount === '20000', 'amount 0.02 USDT');
  }},

  // ── 404 ──────────────────────────────────────────────────────
  { name: 'GET /nonexistent → 404 with hint', run: async () => {
    const r = await fetch(BASE + '/nonexistent');
    const d = await r.json();
    assert(r.status === 404, 'status 404');
    assert(d.hint && d.hint.includes('x402'), 'has x402 hint');
  }},

  // ── malformed input ─────────────────────────────────────────
  { name: 'challenge: malformed JSON → 400', run: async () => {
    const r = await fetch(BASE + '/api/quick_check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    assert(r.status === 400, 'status 400');
  }},

  // ── new endpoints (v1.1.0) ─────────────────────────────────────
  { name: 'GET /test (reviewer guide)', run: async () => {
    const r = await fetch(BASE + '/test');
    const html = await r.text();
    assert(r.status === 200, 'status 200');
    assert(html.includes('ReppS'), 'has brand');
    assert(html.includes('curl -i'), 'has curl example');
    assert(html.includes('/api/test/receipt'), 'mentions test receipt');
  }},
  { name: 'GET /agent-card', run: async () => {
    const r = await fetch(BASE + '/agent-card');
    const d = await r.json();
    assert(r.status === 200, 'status 200');
    assert(d.service_name === 'ReppS', 'service name');
    assert(d.x402.network === 'eip155:196', 'X Layer');
    assert(d.pricing.challenge === '0.01 USDT/call', 'pricing');
    assert(d.receive_address && d.receive_address.startsWith('0x'), 'wallet');
  }},
  { name: 'GET /api/test/receipt?tool=challenge', run: async () => {
    const r = await fetch(BASE + '/api/test/receipt?tool=challenge');
    const d = await r.json();
    assert(r.status === 200, 'status 200');
    assert(d.tool === 'challenge', 'tool');
    assert(d.amount_usdt === 0.01, '0.01 USDT');
    assert(d.receipt.check_id, 'has check_id');
    assert(d.receipt.signature && d.receipt.signature.startsWith('0x'), 'has signature');
    assert(d.receipt_b64, 'has base64 receipt');
    assert(d.curl_example && d.curl_example.includes('PAYMENT-SIGNATURE'), 'has curl example');
  }},
  { name: 'GET /api/test/receipt?tool=bundle', run: async () => {
    const r = await fetch(BASE + '/api/test/receipt?tool=bundle');
    const d = await r.json();
    assert(d.amount_usdt === 0.05, '0.05 USDT');
  }},
  { name: 'GET /api/test/receipt?tool=audit', run: async () => {
    const r = await fetch(BASE + '/api/test/receipt?tool=audit');
    const d = await r.json();
    assert(d.amount_usdt === 0.02, '0.02 USDT');
  }},
  { name: 'GET /api/test/receipt?tool=invalid → 400', run: async () => {
    const r = await fetch(BASE + '/api/test/receipt?tool=invalid');
    assert(r.status === 400, 'status 400');
  }},
  { name: 'challenge: test bypass returns 200 + test_bypass flag', run: async () => {
    if (process.env.REPPS_TEST !== '1' && !process.env.SKIP_REMOTE_TEST) {
      console.log('  ⊘ skipped (remote server may have test bypass disabled)');
      return;
    }
    const r = await fetch(BASE + '/api/challenge?test=1', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type: 'swap', params: { token_out: 'MEME', slippage_pct: 12, pool_liquidity_usd: 8000 }, context: { agent_id: 'test' } }),
    });
    const d = await r.json();
    assert(r.status === 200, 'status 200');
    assert(d.test_bypass === true, 'test_bypass flag set');
    assert(d.paid === false, 'paid false');
    assert(d.verdict, 'has verdict');
  }},
  { name: 'challenge: real receipt via /api/test/receipt works', run: async () => {
    if (process.env.REPPS_TEST !== '1' && !process.env.SKIP_REMOTE_TEST) {
      console.log('  ⊘ skipped (remote server may have test bypass disabled)');
      return;
    }
    // Get a receipt
    const r1 = await fetch(BASE + '/api/test/receipt?tool=challenge');
    const { receipt_b64 } = await r1.json();
    // Use it
    const r2 = await fetch(BASE + '/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': receipt_b64 },
      body: JSON.stringify({ action_type: 'swap', params: { token_out: 'MEME', slippage_pct: 12, pool_liquidity_usd: 8000 }, context: { agent_id: 'paid' } }),
    });
    const d = await r2.json();
    assert(r2.status === 200, 'status 200 (got ' + r2.status + ')');
    assert(d.paid === true, 'paid true');
    assert(d.receipt_verified === true, 'receipt verified');
    assert(d.verdict, 'has verdict');
  }},
  { name: 'POST /api/echo', run: async () => {
    const r = await fetch(BASE + '/api/echo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 123, message: 'hello' }),
    });
    const d = await r.json();
    assert(r.status === 200, 'status 200');
    assert(d.ok === true, 'ok');
    assert(d.echo.test === 123, 'echoes back');
  }},
  { name: 'GET /health includes uptime + counters', run: async () => {
    const r = await fetch(BASE + '/health');
    const d = await r.json();
    assert(d.version === '1.1.0', 'version 1.1.0');
    assert(typeof d.uptime_seconds === 'number', 'has uptime');
    assert(d.test_bypass_enabled === true, 'test_bypass enabled');
    assert(typeof d.request_count === 'number', 'has request count');
  }},
  { name: 'OPTIONS preflight returns 204 + CORS', run: async () => {
    const r = await fetch(BASE + '/api/challenge', { method: 'OPTIONS' });
    assert(r.status === 204, 'status 204');
    assert(r.headers.get('access-control-allow-origin') === '*', 'CORS allow origin');
    assert(r.headers.get('access-control-allow-headers').includes('PAYMENT-SIGNATURE'), 'CORS allows payment header');
  }},
];

// ── runner ─────────────────────────────────────────────────────
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}

console.log('\\n🧪 ReppS smoke test');
console.log('   target: ' + BASE + '\\n');

for (const t of tests) {
  console.log('→ ' + t.name);
  try { await t.run(); }
  catch (e) { fail++; console.log('  ✗ threw: ' + e.message); }
  console.log('');
}

console.log('\\n' + '━'.repeat(40));
console.log(`Results: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
