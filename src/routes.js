// Route handlers — one per x402 endpoint
import { review } from './adversarial.js';
import { getAuditTrail } from './x402.js';
import { simulate } from './simulator.js';

export async function handleChallenge(body) {
  return review(normalize(body));
}

export async function handleQuickCheck(body) {
  const result = await review(normalize(body));
  // Slim down for free tier — only the most important fields
  return {
    check_id: result.check_id,
    timestamp: result.timestamp,
    verdict: result.verdict,
    confidence: result.confidence,
    top_risk: result.risks[0] || 'No critical risks detected.',
    action_type: result.action_type,
    upgrade_hint: 'For full breakdown (all risks, alternatives, adversarial questions, reasoning), use /api/challenge (paid, 0.01 USDT) or /api/bundle (paid, 0.05 USDT for 5).',
  };
}

export async function handleBundle(body) {
  const norm = normalize(body);
  // If body has array of actions, run each
  if (Array.isArray(norm.actions)) {
    const results = await Promise.all(norm.actions.slice(0, 5).map((a) => review(a)));
    return {
      bundle_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      results,
      summary: summarizeBundle(results),
    };
  }
  // Otherwise: 5 sequential challenges on the same action with different framings
  const framings = [
    { ...norm, context: { ...norm.context, _framing: 'baseline' } },
    { ...norm, context: { ...norm.context, urgent: true, _framing: 'under_pressure' } },
    { ...norm, context: { ...norm.context, first_time: true, _framing: 'no_experience' } },
    { ...norm, context: { ...norm.context, _framing: 'worst_case' } },
    { ...norm, context: { ...norm.context, _framing: 'long_term' } },
  ];
  const results = await Promise.all(framings.map((f) => review(f)));
  return {
    bundle_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    results,
    summary: summarizeBundle(results),
  };
}

export async function handleSimulate(body) {
  return simulate(normalizeSim(body));
}

function normalizeSim(body) {
  // Accept either flat shape or wrapped {params, context}
  return {
    action_type: body.action_type || body.type || body.params?.action_type || 'unknown',
    params: body.params || body.parameters || body.details || body,
    context: body.context || {},
  };
}

export async function handleAudit(body) {
  const trail = getAuditTrail();
  const subset = body.check_ids
    ? trail.filter((r) => body.check_ids.includes(r.check_id))
    : trail;

  return {
    audit_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    format: body.format || 'soc2-lite',
    entries: subset.map((r) => ({
      check_id: r.check_id,
      amount: r.amount,
      asset: r.asset,
      network: r.network,
      verified_at: r.verified_at,
      nonce: r.nonce,
      signature: r.signature,
    })),
    count: subset.length,
    generated_for: body.agent_id || 'self',
  };
}

// ── helpers ────────────────────────────────────────────────────
function normalize(body) {
  return {
    action_type: body.action_type || body.type || 'unknown',
    params: body.params || body.parameters || body.details || {},
    context: body.context || {},
  };
}

function summarizeBundle(results) {
  const verdicts = results.map((r) => r.verdict);
  const aborts = verdicts.filter((v) => v === 'ABORT').length;
  const reviews = verdicts.filter((v) => v === 'REVIEW').length;
  const proceeds = verdicts.filter((v) => v === 'PROCEED').length;
  return {
    total: results.length,
    proceed: proceeds,
    review: reviews,
    abort: aborts,
    consensus: aborts > 0 ? 'DO_NOT_PROCEED' : reviews > results.length / 2 ? 'PROCEED_WITH_CAUTION' : 'SAFE_TO_PROCEED',
  };
}
