// ReppS — Adversarial Cognitive Layer for AI Agents
// x402 v2 pay-per-call ASP on X Layer (eip155:196)
//
// Endpoints:
//   GET  /                              → landing page
//   GET  /.well-known/x402              → x402 v2 service manifest
//   GET  /health                       → liveness + config block
//   GET  /demo                          → live demo UI (no signup)
//   POST /api/quick_check              → free (3/day/IP) heuristic verdict
//   POST /api/challenge                → $0.01 USDT — full adversarial review
//   POST /api/bundle                    → $0.05 USDT — 5 challenge calls
//   POST /api/audit                     → $0.02 USDT — audit-ready log
//
// x402 v2 challenge network: eip155:196 (X Layer)
// Asset: USDT0 (USD₮0)
// Pricing: amount in min units, decimals=6, so 10000 = 0.01 USDT

import http from 'node:http';
import { URL } from 'node:url';
import { serveLanding } from './landing.js';
import { serveDemo } from './demo.js';
import { handleChallenge, handleQuickCheck, handleBundle, handleAudit } from './routes.js';
import { x402Challenge, verifyReceipt, freeQuotaOk } from './x402.js';

const PORT = process.env.PORT || 10000;
const RECEIVE_ADDRESS = process.env.RECEIVE_ADDRESS || '0x0000000000000000000000000000000000000000';
const NETWORK = 'eip155:196'; // X Layer mainnet
const ASSET = 'USDT0';
const FACILITATOR = 'https://www.okx.com';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // CORS for the demo + agent clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, PAYMENT-SIGNATURE, X-PAYMENT');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // ── public routes ─────────────────────────────────────────────
    if (path === '/' && method === 'GET') return serveLanding(req, res);
    if (path === '/demo' && method === 'GET') return serveDemo(req, res);
    if (path === '/.well-known/x402' && method === 'GET') return serveManifest(res);
    if (path === '/health' && method === 'GET') return serveHealth(res);

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
            reset_in_hours: quota.reset_in_hours,
          });
        }
        const result = await handleQuickCheck(body);
        return sendJson(res, 200, { ...result, free_remaining_today: 3 - quota.used });
      });
    }

    // ── paid endpoint: /api/challenge ($0.01) ─────────────────────
    if (path === '/api/challenge' && method === 'POST') {
      return readJson(req, res, async (body) => {
        const sig = req.headers['payment-signature'] || req.headers['x-payment'];
        if (!sig) {
          // No payment → return 402 challenge
          return x402Challenge(res, {
            resource: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/challenge`,
            amount: '10000', // 0.01 USDT (decimals=6)
            description: 'Adversarial review of an agent\'s planned action. Returns risk score, edge cases, alternatives.',
            payTo: RECEIVE_ADDRESS,
            network: NETWORK,
            asset: ASSET,
          });
        }
        // Verify receipt
        const verify = await verifyReceipt(sig, { amount: '10000', payTo: RECEIVE_ADDRESS, network: NETWORK });
        if (!verify.ok) {
          return sendJson(res, 402, { error: 'invalid_receipt', message: verify.reason });
        }
        const result = await handleChallenge(body);
        return sendJson(res, 200, { ...result, paid: true, receipt_verified: true });
      });
    }

    // ── paid endpoint: /api/bundle ($0.05 = 5 challenges) ─────────
    if (path === '/api/bundle' && method === 'POST') {
      return readJson(req, res, async (body) => {
        const sig = req.headers['payment-signature'] || req.headers['x-payment'];
        if (!sig) {
          return x402Challenge(res, {
            resource: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/bundle`,
            amount: '50000', // 0.05 USDT
            description: 'Bundle of 5 adversarial reviews. Cheaper than 5 individual calls. Includes audit log.',
            payTo: RECEIVE_ADDRESS,
            network: NETWORK,
            asset: ASSET,
          });
        }
        const verify = await verifyReceipt(sig, { amount: '50000', payTo: RECEIVE_ADDRESS, network: NETWORK });
        if (!verify.ok) {
          return sendJson(res, 402, { error: 'invalid_receipt', message: verify.reason });
        }
        const result = await handleBundle(body);
        return sendJson(res, 200, { ...result, paid: true, receipt_verified: true });
      });
    }

    // ── paid endpoint: /api/audit ($0.02) ─────────────────────────
    if (path === '/api/audit' && method === 'POST') {
      return readJson(req, res, async (body) => {
        const sig = req.headers['payment-signature'] || req.headers['x-payment'];
        if (!sig) {
          return x402Challenge(res, {
            resource: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/audit`,
            amount: '20000', // 0.02 USDT
            description: 'Format a set of past challenges into an audit-ready log (SOC2-style).',
            payTo: RECEIVE_ADDRESS,
            network: NETWORK,
            asset: ASSET,
          });
        }
        const verify = await verifyReceipt(sig, { amount: '20000', payTo: RECEIVE_ADDRESS, network: NETWORK });
        if (!verify.ok) {
          return sendJson(res, 402, { error: 'invalid_receipt', message: verify.reason });
        }
        const result = await handleAudit(body);
        return sendJson(res, 200, { ...result, paid: true, receipt_verified: true });
      });
    }

    // ── 404 ───────────────────────────────────────────────────────
    return sendJson(res, 404, { error: 'not_found', path, hint: 'See /.well-known/x402 for the service manifest.' });
  } catch (err) {
    console.error('[repps] unhandled error:', err);
    return sendJson(res, 500, { error: 'internal_error', message: err.message });
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
      return sendJson(res, 400, { error: 'invalid_json', message: e.message });
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
    homepage: 'https://github.com/ademidun69/repps',
    vendor: {
      name: 'O.A Dolapo (ademidun69)',
      url: 'https://github.com/ademidun69',
    },
    services: [
      {
        id: 'quick_check',
        name: 'Quick Check (Free)',
        description: 'Fast heuristic verdict on a planned action. 3 free calls per day per IP.',
        pricing: { amount: '0', currency: 'USDT0', per: 'call' },
        endpoint: { method: 'POST', url: '/api/quick_check', body_schema: 'see README' },
      },
      {
        id: 'challenge',
        name: 'Challenge (Paid)',
        description: 'Full adversarial review: risk score, edge cases, alternatives, adversarial questions.',
        pricing: { amount: '0.01', currency: 'USDT0', per: 'call' },
        x402: { network: 'eip155:196', scheme: 'exact', asset: 'USDT0', decimals: 6, amount_min: '10000' },
        endpoint: { method: 'POST', url: '/api/challenge', body_schema: 'see README' },
      },
      {
        id: 'bundle',
        name: 'Bundle of 5 (Paid)',
        description: '5 challenge calls bundled, 50% cheaper. Best for agents doing batch reviews.',
        pricing: { amount: '0.05', currency: 'USDT0', per: 'bundle' },
        x402: { network: 'eip155:196', scheme: 'exact', asset: 'USDT0', decimals: 6, amount_min: '50000' },
        endpoint: { method: 'POST', url: '/api/bundle', body_schema: 'see README' },
      },
      {
        id: 'audit',
        name: 'Audit Log (Paid)',
        description: 'Format a set of past challenges into an audit-ready log.',
        pricing: { amount: '0.02', currency: 'USDT0', per: 'log' },
        x402: { network: 'eip155:196', scheme: 'exact', asset: 'USDT0', decimals: 6, amount_min: '20000' },
        endpoint: { method: 'POST', url: '/api/audit', body_schema: 'see README' },
      },
    ],
    x402_endpoint_example: {
      url: 'https://repps.onrender.com/api/challenge',
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
  return sendJson(res, 200, {
    status: 'ok',
    service: 'repps',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    network: NETWORK,
    asset: ASSET,
    receive_address: RECEIVE_ADDRESS === '0x0000000000000000000000000000000000000000' ? 'NOT_SET' : 'configured',
    llm_mode: process.env.OPENAI_API_KEY ? 'openai-gpt-4o-mini' : 'rule-engine-only',
    uptime_seconds: Math.round(process.uptime()),
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[repps] listening on :${PORT}`);
  console.log(`[repps] network=${NETWORK} asset=${ASSET} receive=${RECEIVE_ADDRESS.slice(0, 8)}...`);
  console.log(`[repps] llm=${process.env.OPENAI_API_KEY ? 'openai' : 'rule-engine'}`);
});
