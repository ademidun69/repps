// ReppS — Adversarial Cognitive Layer for AI Agents
// x402 v2 pay-per-call ASP on X Layer (eip155:196)
//
// Endpoints:
//   GET  /                              → landing page
//   GET  /demo                          → live demo UI (no signup)
//   GET  /test                          → OKX-reviewer-friendly test guide
//   GET  /.well-known/x402              → x402 v2 service manifest
//   GET  /health                        → liveness + config block
//   GET  /agent-card                    → ready-to-paste agent card (JSON + md)
//   GET  /api/test/receipt              → generates a valid receipt for ?tool= endpoint
//   POST /api/quick_check              → free (3/day/IP) heuristic verdict
//   POST /api/challenge                → $0.01 USDT — full adversarial review
//   POST /api/bundle                    → $0.05 USDT — 5 challenge calls
//   POST /api/audit                     → $0.02 USDT — audit-ready log
//   POST /api/echo                      → simple echo for connectivity testing
//
// Test mode: pass ?test=1 to any paid endpoint to bypass payment (for reviewer/QA only).
// Always-off in production: set REJECT_TEST_BYPASS=1 env var to disable.
//
// x402 v2 challenge network: eip155:196 (X Layer)
// Asset: USDT0 (USD₮0)
// Pricing: amount in min units, decimals=6, so 10000 = 0.01 USDT

import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import { serveLanding } from './landing.js';
import { serveDemo } from './demo.js';
import { handleChallenge, handleQuickCheck, handleBundle, handleAudit } from './routes.js';
import { x402Challenge, verifyReceipt, freeQuotaOk, getAuditTrail } from './x402.js';

const PORT = process.env.PORT || 10000;
const RECEIVE_ADDRESS = process.env.RECEIVE_ADDRESS || '0x0000000000000000000000000000000000000000';
const NETWORK = 'eip155:196'; // X Layer mainnet
const ASSET = 'USDT0';
const VERSION = '1.1.0';
const SERVICE_START = Date.now();
const TEST_BYPASS_ENABLED = process.env.REJECT_TEST_BYPASS !== '1';

// Counters for /health
const COUNTERS = { total_requests: 0, by_endpoint: {}, errors: 0 };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;
  const query = Object.fromEntries(url.searchParams);

  // CORS for the demo + agent clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, PAYMENT-SIGNATURE, X-PAYMENT');
  res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-SIGNATURE');
  res.setHeader('X-Service', 'repps');
  res.setHeader('X-Service-Version', VERSION);

  // Count
  COUNTERS.total_requests++;
  const ep = `${method} ${path}`;
  COUNTERS.by_endpoint[ep] = (COUNTERS.by_endpoint[ep] || 0) + 1;

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // ── public routes ─────────────────────────────────────────────
    if (path === '/' && method === 'GET') return serveLanding(req, res);
    if (path === '/demo' && method === 'GET') return serveDemo(req, res);
    if (path === '/test' && method === 'GET') return serveTestGuide(res);
    if (path === '/.well-known/x402' && method === 'GET') return serveManifest(res);
    if (path === '/health' && method === 'GET') return serveHealth(res);
    if (path === '/agent-card' && method === 'GET') return serveAgentCard(res);
    if (path === '/api/test/receipt' && method === 'GET') return serveTestReceipt(res, query);
    if (path === '/api/echo' && method === 'POST') {
      return readJson(req, res, (body) => sendJson(res, 200, { ok: true, echo: body, timestamp: new Date().toISOString() }));
    }

    // ── free endpoint: /api/quick_check ───────────────────────────
    if (path === '/api/quick_check' && method === 'POST') {
      return readJson(req, res, async (body) => {
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0').split(',')[0].trim();
        const quota = await freeQuotaOk(ip, 'quick_check');
        if (!quota.ok) {
          return sendJson(res, 429, {
            error: 'quota_exceeded',
            message: `Free tier: 3 calls/day. Resets at 00:00 UTC. Use /api/challenge (paid) for unlimited.`,
            remaining_today: 0,
            reset_in_hours: Math.round(quota.reset_in_hours * 10) / 10,
            upgrade_url: 'https://repps.xyz/api/challenge',
          });
        }
        const result = await handleQuickCheck(body);
        return sendJson(res, 200, {
          ...result,
          free_remaining_today: 3 - quota.used,
          upgrade_hint: 'For full breakdown (all risks, alternatives, adversarial questions, reasoning), use /api/challenge (paid, 0.01 USDT) or /api/bundle (paid, 0.05 USDT for 5).',
        });
      });
    }

    // ── paid endpoint: /api/challenge ($0.01) ─────────────────────
    if (path === '/api/challenge' && method === 'POST') {
      return readJson(req, res, async (body) => {
        const isTestBypass = TEST_BYPASS_ENABLED && (query.test === '1' || body._test === true);
        const sig = req.headers['payment-signature'] || req.headers['x-payment'];
        if (!sig && !isTestBypass) {
          return x402Challenge(res, {
            resource: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/challenge`,
            amount: '10000',
            description: "Adversarial review of an agent's planned action. Returns risk score, edge cases, alternatives.",
            payTo: RECEIVE_ADDRESS,
            network: NETWORK,
            asset: ASSET,
          });
        }
        if (sig && !isTestBypass) {
          const verify = await verifyReceipt(sig, { amount: '10000', payTo: RECEIVE_ADDRESS, network: NETWORK });
          if (!verify.ok) {
            return sendJson(res, 402, { error: 'invalid_receipt', message: verify.reason, hint: 'Generate a test receipt at GET /api/test/receipt' });
          }
        }
        const result = await handleChallenge(body);
        return sendJson(res, 200, {
          ...result,
          paid: !isTestBypass,
          receipt_verified: !isTestBypass,
          test_bypass: isTestBypass || undefined,
        });
      });
    }

    // ── paid endpoint: /api/bundle ($0.05 = 5 challenges) ─────────
    if (path === '/api/bundle' && method === 'POST') {
      return readJson(req, res, async (body) => {
        const isTestBypass = TEST_BYPASS_ENABLED && (query.test === '1' || body._test === true);
        const sig = req.headers['payment-signature'] || req.headers['x-payment'];
        if (!sig && !isTestBypass) {
          return x402Challenge(res, {
            resource: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/bundle`,
            amount: '50000',
            description: 'Bundle of 5 adversarial reviews. Cheaper than 5 individual calls. Includes audit log.',
            payTo: RECEIVE_ADDRESS,
            network: NETWORK,
            asset: ASSET,
          });
        }
        if (sig && !isTestBypass) {
          const verify = await verifyReceipt(sig, { amount: '50000', payTo: RECEIVE_ADDRESS, network: NETWORK });
          if (!verify.ok) {
            return sendJson(res, 402, { error: 'invalid_receipt', message: verify.reason, hint: 'Generate a test receipt at GET /api/test/receipt?tool=bundle' });
          }
        }
        const result = await handleBundle(body);
        return sendJson(res, 200, {
          ...result,
          paid: !isTestBypass,
          receipt_verified: !isTestBypass,
          test_bypass: isTestBypass || undefined,
        });
      });
    }

    // ── paid endpoint: /api/audit ($0.02) ─────────────────────────
    if (path === '/api/audit' && method === 'POST') {
      return readJson(req, res, async (body) => {
        const isTestBypass = TEST_BYPASS_ENABLED && (query.test === '1' || body._test === true);
        const sig = req.headers['payment-signature'] || req.headers['x-payment'];
        if (!sig && !isTestBypass) {
          return x402Challenge(res, {
            resource: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/audit`,
            amount: '20000',
            description: 'Format a set of past challenges into an audit-ready log (SOC2-style).',
            payTo: RECEIVE_ADDRESS,
            network: NETWORK,
            asset: ASSET,
          });
        }
        if (sig && !isTestBypass) {
          const verify = await verifyReceipt(sig, { amount: '20000', payTo: RECEIVE_ADDRESS, network: NETWORK });
          if (!verify.ok) {
            return sendJson(res, 402, { error: 'invalid_receipt', message: verify.reason, hint: 'Generate a test receipt at GET /api/test/receipt?tool=audit' });
          }
        }
        const result = await handleAudit(body);
        return sendJson(res, 200, {
          ...result,
          paid: !isTestBypass,
          receipt_verified: !isTestBypass,
          test_bypass: isTestBypass || undefined,
        });
      });
    }

    // ── 404 ───────────────────────────────────────────────────────
    return sendJson(res, 404, {
      error: 'not_found',
      path,
      hint: 'See /.well-known/x402 for the service manifest, or /test for a reviewer guide.',
      endpoints: [
        'GET  /',
        'GET  /demo',
        'GET  /test',
        'GET  /health',
        'GET  /.well-known/x402',
        'GET  /agent-card',
        'GET  /api/test/receipt?tool=challenge|bundle|audit',
        'POST /api/quick_check',
        'POST /api/challenge',
        'POST /api/bundle',
        'POST /api/audit',
        'POST /api/echo',
      ],
    });
  } catch (err) {
    COUNTERS.errors++;
    console.error('[repps] unhandled error:', err);
    return sendJson(res, 500, { error: 'internal_error', message: err.message, hint: 'Please report at https://github.com/ademidun69/repps/issues' });
  }
});

// ── helpers ────────────────────────────────────────────────────
function readJson(req, res, cb) {
  let chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    let body = {};
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      return sendJson(res, 400, { error: 'invalid_json', message: e.message, hint: 'Send a valid JSON body' });
    }
    cb(body);
  });
  req.on('error', (e) => sendJson(res, 400, { error: 'request_error', message: e.message }));
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

function serveManifest(res) {
  return sendJson(res, 200, {
    x402Version: 2,
    name: 'ReppS — Adversarial Cognitive Layer',
    description: "The devil's advocate your AI agent calls before it acts. Returns risk score, edge cases missed, alternative interpretations.",
    homepage: 'https://repps.xyz',
    repo: 'https://github.com/ademidun69/repps',
    vendor: {
      name: 'Ademidun (ademidun69)',
      url: 'https://github.com/ademidun69',
    },
    services: [
      {
        id: 'quick_check',
        name: 'Quick Check (Free)',
        description: 'Fast heuristic verdict on a planned action. 3 free calls per day per IP.',
        pricing: { amount: '0', currency: 'USDT0', per: 'call' },
        endpoint: { method: 'POST', url: '/api/quick_check', body_schema: 'see /test' },
      },
      {
        id: 'challenge',
        name: 'Challenge (Paid)',
        description: 'Full adversarial review: risk score, edge cases, alternatives, adversarial questions, reasoning.',
        pricing: { amount: '0.01', currency: 'USDT0', per: 'call' },
        x402: { network: 'eip155:196', scheme: 'exact', asset: 'USDT0', decimals: 6, amount_min: '10000' },
        endpoint: { method: 'POST', url: '/api/challenge', body_schema: 'see /test' },
      },
      {
        id: 'bundle',
        name: 'Bundle of 5 (Paid)',
        description: '5 challenge calls bundled, 50% cheaper. Best for agents doing batch reviews with different framings.',
        pricing: { amount: '0.05', currency: 'USDT0', per: 'bundle' },
        x402: { network: 'eip155:196', scheme: 'exact', asset: 'USDT0', decimals: 6, amount_min: '50000' },
        endpoint: { method: 'POST', url: '/api/bundle', body_schema: 'see /test' },
      },
      {
        id: 'audit',
        name: 'Audit Log (Paid)',
        description: 'Format a set of past challenges into an audit-ready log (SOC2-lite format).',
        pricing: { amount: '0.02', currency: 'USDT0', per: 'log' },
        x402: { network: 'eip155:196', scheme: 'exact', asset: 'USDT0', decimals: 6, amount_min: '20000' },
        endpoint: { method: 'POST', url: '/api/audit', body_schema: 'see /test' },
      },
    ],
    x402_endpoint_example: {
      url: 'https://repps.xyz/api/challenge',
      method: 'POST',
      payment: {
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:196',
            amount: '10000',
            payTo: RECEIVE_ADDRESS,
            asset: 'USDT0',
            maxTimeoutSeconds: 300,
            extra: { name: 'USD₮0', version: '1' },
          },
        ],
      },
    },
  });
}

function serveHealth(res) {
  const mem = process.memoryUsage();
  return sendJson(res, 200, {
    status: 'ok',
    service: 'repps',
    version: VERSION,
    timestamp: new Date().toISOString(),
    network: NETWORK,
    asset: ASSET,
    receive_address: RECEIVE_ADDRESS === '0x0000000000000000000000000000000000000000' ? 'NOT_SET' : 'configured',
    llm_mode: process.env.OPENAI_API_KEY ? 'openai-gpt-4o-mini' : 'rule-engine-only',
    uptime_seconds: Math.round(process.uptime()),
    uptime_since: new Date(SERVICE_START).toISOString(),
    test_bypass_enabled: TEST_BYPASS_ENABLED,
    request_count: COUNTERS.total_requests,
    error_count: COUNTERS.errors,
    memory_mb: { rss: Math.round(mem.rss / 1024 / 1024), heap: Math.round(mem.heapUsed / 1024 / 1024) },
    endpoints_hit: COUNTERS.by_endpoint,
  });
}

function serveAgentCard(res) {
  return sendJson(res, 200, {
    service_name: 'ReppS',
    tagline: "The devil's advocate your agent calls before it acts.",
    description: 'ReppS is an adversarial review service for AI agents. Before an agent swaps, sends, hires, deploys, or commits to any non-trivial action, it calls ReppS. ReppS returns a risk score, edge cases the agent missed, alternative interpretations, and the questions the agent should have asked itself. Built for the OKX.AI Genesis Hackathon 2026.',
    category: 'Software Utility',
    homepage: 'https://repps.xyz',
    manifest: 'https://repps.xyz/.well-known/x402',
    demo: 'https://repps.xyz/demo',
    repo: 'https://github.com/ademidun69/repps',
    vendor: { name: 'Ademidun (ademidun69)', email: 'ademidun965@gmail.com' },
    x402: { version: 2, network: 'eip155:196', asset: 'USDT0', decimals: 6, scheme: 'exact', max_timeout_seconds: 300 },
    receive_address: RECEIVE_ADDRESS,
    pricing: {
      quick_check: 'free (3/day/IP)',
      challenge: '0.01 USDT/call',
      bundle: '0.05 USDT/bundle (5 calls)',
      audit: '0.02 USDT/log',
    },
    use_cases: [
      'DeFi trading agent pre-flight: "Is this swap safe?"',
      'Social media agent: "Is this DM safe to send?"',
      'Deployer agent: "Is this contract safe to deploy?"',
      'Orchestrator agent: "Should I hire this sub-agent?"',
      'Compliance team: "Show me the audit log for last week."',
    ],
  });
}

// Reviewer-friendly test guide
function serveTestGuide(res) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ReppS — Reviewer Test Guide</title>
<style>
  body { font: 15px/1.6 -apple-system,BlinkMacSystemFont,Inter,Segoe UI,sans-serif; max-width:900px; margin:24px auto; padding:0 20px; color:#1a1a1a; }
  h1 { font-size:28px; margin:0 0 4px; }
  .sub { color:#666; margin:0 0 24px; }
  h2 { font-size:20px; margin:32px 0 8px; border-bottom:1px solid #eee; padding-bottom:4px; }
  pre { background:#0b0d12; color:#e8eaf2; padding:16px; border-radius:8px; overflow:auto; font-size:13px; line-height:1.5; }
  code { background:#f4f4f4; padding:2px 6px; border-radius:4px; font-size:13px; }
  .note { background:#fff8e1; border-left:4px solid #f59e0b; padding:12px 16px; border-radius:4px; margin:16px 0; }
  .ok { background:#d1fae5; border-left:4px solid #10b981; padding:12px 16px; border-radius:4px; margin:16px 0; }
  .step { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin:16px 0; }
  .step h3 { margin:0 0 8px; font-size:16px; }
  a { color:#1d4ed8; }
</style>
</head>
<body>
<h1>🧪 ReppS — Reviewer Test Guide</h1>
<p class="sub">OKX.AI Genesis Hackathon 2026 · Agent #5527 · For marketplace reviewers</p>

<div class="ok">
  ✅ <strong>All endpoints below are public and free to test.</strong> The <code>?test=1</code> flag on paid endpoints is a hackathon-only review aid — it lets you test the full paid flow without a real wallet. Set <code>REJECT_TEST_BYPASS=1</code> in production to disable.
</div>

<h2>0. Connectivity (10 sec)</h2>
<div class="step">
  <h3>Sanity check</h3>
  <pre>curl https://repps.xyz/health</pre>
  <p>Expect: <code>status: ok</code>, <code>network: eip155:196</code>, <code>asset: USDT0</code>, <code>uptime_seconds</code> growing.</p>
</div>

<h2>1. x402 v2 spec compliance (30 sec)</h2>
<div class="step">
  <h3>Verify the 402 challenge format</h3>
  <pre>curl -i -X POST https://repps.xyz/api/challenge \\
  -H "Content-Type: application/json" \\
  -d '{"action_type":"swap","params":{"token_out":"MEME","slippage_pct":12,"pool_liquidity_usd":8000},"context":{"agent_id":"reviewer"}}'</pre>
  <p>Expect: HTTP <code>402</code> with <code>PAYMENT-REQUIRED</code> header (base64) and JSON body containing <code>x402Version: 2</code>, <code>accepts[0].network: "eip155:196"</code>, <code>accepts[0].amount: "10000"</code> (= 0.01 USDT), <code>accepts[0].payTo</code> (an X Layer address), <code>accepts[0].extra.name: "USD₮0"</code>.</p>
</div>

<div class="step">
  <h3>Check the manifest</h3>
  <pre>curl https://repps.xyz/.well-known/x402</pre>
  <p>Expect: 4 services listed (quick_check, challenge, bundle, audit), x402 v2 spec, valid receive address.</p>
</div>

<h2>2. Free tier (no payment needed)</h2>
<div class="step">
  <h3>Test the free quick_check</h3>
  <pre>curl -X POST https://repps.xyz/api/quick_check \\
  -H "Content-Type: application/json" \\
  -d '{"action_type":"swap","params":{"token_out":"MEME","slippage_pct":12,"pool_liquidity_usd":8000},"context":{"agent_id":"reviewer"}}'</pre>
  <p>Expect: <code>verdict: REVIEW</code> or <code>ABORT</code>, <code>top_risk</code> mentioning slippage, <code>free_remaining_today: 2</code> (decrements per call).</p>
</div>

<h2>3. Paid flow — test bypass</h2>
<div class="step">
  <h3>Test the full paid flow without a wallet</h3>
  <pre>curl -X POST "https://repps.xyz/api/challenge?test=1" \\
  -H "Content-Type: application/json" \\
  -d '{"action_type":"swap","params":{"token_out":"MEME","slippage_pct":12,"pool_liquidity_usd":8000},"context":{"agent_id":"reviewer"}}'</pre>
  <p>Expect: HTTP 200 with full review (verdict, confidence, risks, alternatives, adversarial_questions, reasoning). Response will include <code>test_bypass: true</code> to mark that payment was bypassed for testing.</p>
</div>

<div class="step">
  <h3>Test the bundle endpoint</h3>
  <pre>curl -X POST "https://repps.xyz/api/bundle?test=1" \\
  -H "Content-Type: application/json" \\
  -d '{"action_type":"swap","params":{"token_out":"MEME","slippage_pct":12,"pool_liquidity_usd":8000},"context":{"agent_id":"reviewer"}}'</pre>
  <p>Expect: 5 review results (different framings) + consensus summary.</p>
</div>

<div class="step">
  <h3>Test the audit endpoint</h3>
  <pre>curl -X POST "https://repps.xyz/api/audit?test=1" \\
  -H "Content-Type: application/json" \\
  -d '{"format":"soc2-lite","agent_id":"reviewer"}'</pre>
  <p>Expect: audit_id, format, entries array, count.</p>
</div>

<h2>4. Real payment flow (with a test receipt)</h2>
<div class="step">
  <h3>Generate a test receipt</h3>
  <pre>RECEIPT=$(curl -s https://repps.xyz/api/test/receipt?tool=challenge | python3 -c "import json,sys; print(json.load(sys.stdin)['receipt_b64'])")
echo "$RECEIPT" | head -c 80; echo "..."</pre>
</div>
<div class="step">
  <h3>Use the receipt to call the paid endpoint</h3>
  <pre>curl -X POST https://repps.xyz/api/challenge \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: $RECEIPT" \\
  -d '{"action_type":"swap","params":{"token_out":"MEME","slippage_pct":12,"pool_liquidity_usd":8000},"context":{"agent_id":"reviewer"}}'</pre>
  <p>Expect: HTTP 200 with full review, <code>paid: true</code>, <code>receipt_verified: true</code>.</p>
</div>

<h2>5. Edge cases worth testing</h2>
<div class="step">
  <h3>Burn address (should ABORT)</h3>
  <pre>curl -X POST "https://repps.xyz/api/quick_check" \\
  -H "Content-Type: application/json" \\
  -d '{"action_type":"send","params":{"to":"0x0000000000000000000000000000000000000000","amount":"100","asset":"USDT"},"context":{}}'</pre>
</div>
<div class="step">
  <h3>Scam message (should REVIEW/ABORT)</h3>
  <pre>curl -X POST "https://repps.xyz/api/quick_check" \\
  -H "Content-Type: application/json" \\
  -d '{"action_type":"message","params":{"to":"@user","body":"wire me via western union","channel":"dm"},"context":{}}'</pre>
</div>
<div class="step">
  <h3>Unaudited contract deploy (should REVIEW/ABORT)</h3>
  <pre>curl -X POST "https://repps.xyz/api/quick_check" \\
  -H "Content-Type: application/json" \\
  -d '{"action_type":"deploy","params":{"bytecode":"0x6080604052"},"context":{}}'</pre>
</div>

<div class="ok">
  <p><strong>All checks pass in &lt; 2 seconds.</strong> ReppS works without a wallet (free tier + test bypass), with a wallet (real x402), and gracefully errors on bad input (400 / 402 / 404 / 429 all return clean JSON).</p>
  <p>Questions? Open an issue at <a href="https://github.com/ademidun69/repps/issues">github.com/ademidun69/repps</a>.</p>
</div>

</body>
</html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// Generate a valid test receipt for the configured receive address
function serveTestReceipt(res, query) {
  if (!TEST_BYPASS_ENABLED) {
    return sendJson(res, 403, {
      error: 'test_bypass_disabled',
      message: 'Test receipt generation is disabled in production. Use a real x402 payment flow.',
    });
  }
  const tool = query.tool || 'challenge';
  const amounts = { quick_check: '0', challenge: '10000', bundle: '50000', audit: '20000' };
  const descriptions = {
    quick_check: 'Free quick check',
    challenge: 'Adversarial review',
    bundle: '5-challenge bundle',
    audit: 'Audit log',
  };
  const amount = amounts[tool];
  if (amount === undefined) {
    return sendJson(res, 400, { error: 'invalid_tool', allowed: Object.keys(amounts) });
  }
  const checkId = `reviewer_${tool}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const nonce = `n_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const signature = '0x' + crypto.randomBytes(32).toString('hex');

  const receipt = {
    check_id: checkId,
    amount,
    asset: 'USDT0',
    network: 'eip155:196',
    payTo: RECEIVE_ADDRESS,
    nonce,
    signature,
    description: descriptions[tool],
    generated_at: new Date().toISOString(),
    usage_hint: 'Pass as PAYMENT-SIGNATURE header (base64-encoded) or raw JSON. Set REJECT_TEST_BYPASS=1 on server to disable.',
  };

  return sendJson(res, 200, {
    tool,
    amount_usdt: Number(amount) / 1_000_000,
    payTo: RECEIVE_ADDRESS,
    receipt,
    receipt_b64: Buffer.from(JSON.stringify(receipt)).toString('base64'),
    curl_example: `curl -X POST https://repps.xyz/api/${tool} \\\n  -H "Content-Type: application/json" \\\n  -H "PAYMENT-SIGNATURE: ${Buffer.from(JSON.stringify(receipt)).toString('base64')}" \\\n  -d '{"action_type":"swap","params":{},"context":{"agent_id":"reviewer"}}'`,
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[repps] listening on :${PORT}`);
  console.log(`[repps] version=${VERSION} network=${NETWORK} asset=${ASSET} receive=${RECEIVE_ADDRESS.slice(0, 8)}...`);
  console.log(`[repps] llm=${process.env.OPENAI_API_KEY ? 'openai' : 'rule-engine'} test_bypass=${TEST_BYPASS_ENABLED}`);
  console.log(`[repps] /test guide available at https://repps.xyz/test`);
});
