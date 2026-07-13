// Adversarial engine — the brain of ReppS.
// Two modes:
//   1. Rule engine (always works, no LLM dependency)
//   2. LLM upgrade (uses OPENAI_API_KEY if set, deeper reasoning)
//
// The rule engine handles structured checks (numeric limits, action types,
// known-bad patterns). The LLM mode adds free-form "what could go wrong"
// reasoning. Both return the same shape so the caller doesn't care.

import crypto from 'node:crypto';

const OPENAI_KEY = process.env.OPENAI_API_KEY || null;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

// ── entry point ────────────────────────────────────────────────
export async function review(input) {
  // Always run rule engine first — fast, deterministic, auditable
  const rule = ruleEngine(input);

  // If LLM is available AND the action is non-trivial, upgrade
  let llm = null;
  if (OPENAI_KEY && shouldUseLLM(input)) {
    try {
      llm = await llmReview(input, rule);
    } catch (e) {
      console.warn('[repps] LLM review failed, falling back to rule engine:', e.message);
    }
  }

  // Merge: take the more conservative verdict, union all risks
  const merged = mergeResults(input, rule, llm);
  return merged;
}

// ── rule engine ────────────────────────────────────────────────
function ruleEngine(input) {
  const { action_type, params, context } = input;
  const risks = [];
  const alternatives = [];
  const questions = [];
  let score = 0; // higher = more risk
  const signals = [];

  // ── DeFi swap checks
  if (action_type === 'swap') {
    const { amount, token_in, token_out, slippage_pct, pool_liquidity_usd, chain } = params || {};
    if (slippage_pct > 5) {
      risks.push(`Slippage tolerance ${slippage_pct}% is dangerously high. Front-runner bait.`);
      score += 30;
      questions.push('Did you set this slippage intentionally or is it the default?');
    }
    if (pool_liquidity_usd && amount && Number(amount) / pool_liquidity_usd > 0.01) {
      const impact = ((Number(amount) / pool_liquidity_usd) * 100).toFixed(2);
      risks.push(`Trade size is ${impact}% of pool liquidity. Expect high price impact.`);
      score += 25;
    }
    if (token_out && /honeypot|blacklist|test/i.test(token_out)) {
      risks.push(`Output token ${token_out} matches known-bad patterns.`);
      score += 50;
    }
    if (!slippage_pct) {
      risks.push('No slippage tolerance specified. Default may be unsafe.');
      score += 10;
      questions.push('What slippage should be used?');
    }
    alternatives.push('Use a DEX aggregator (1inch, 0x) for best routing');
    alternatives.push('Split the trade into smaller chunks to reduce price impact');
  }

  // ── Send / transfer checks
  if (action_type === 'send' || action_type === 'transfer') {
    const { to, amount, asset, chain } = params || {};
    if (to && /^0x0{8,}/i.test(to)) {
      risks.push('Recipient is a burn address. Funds will be lost forever.');
      score += 80;
    }
    if (to && to.toLowerCase() === (context?.wallet || '').toLowerCase()) {
      risks.push('Sending to yourself. Wasted gas unless intentional.');
      score += 5;
    }
    if (amount && Number(amount) > 10000) {
      risks.push(`Large transfer (${amount} ${asset || ''}). Confirm authorization.`);
      score += 20;
      questions.push('Is this amount within the approved budget?');
    }
    if (to && /twitter\.com|x\.com/i.test(to)) {
      risks.push('Recipient field looks like a social URL, not a wallet address. Did you confuse formats?');
      score += 40;
    }
  }

  // ── Trade / position checks
  if (action_type === 'trade') {
    const { side, size, leverage, symbol } = params || {};
    if (leverage && leverage > 10) {
      risks.push(`Leverage ${leverage}x is high. Liquidation cascades common.`);
      score += 30;
    }
    if (size && leverage && size * leverage > 100000) {
      risks.push(`Effective position size ($${size * leverage}) is large.`);
      score += 15;
    }
  }

  // ── Message / comms checks
  if (action_type === 'message' || action_type === 'send_message') {
    const { to, body, channel } = params || {};
    if (body && body.length > 5000) {
      risks.push('Message is very long. Recipients may not read it.');
      score += 5;
    }
    if (body && /\b(kill|suicide|harm yourself)\b/i.test(body)) {
      risks.push('CRITICAL: Message contains self-harm language. Pause and reconsider.');
      score += 100;
    }
    if (body && /\b(scam|wire|western union|gift card)\b/i.test(body)) {
      risks.push('Message matches common scam pattern.');
      score += 40;
    }
  }

  // ── Deploy / contract checks
  if (action_type === 'deploy') {
    const { bytecode, source, license } = params || {};
    if (!source) {
      risks.push('No source provided. Cannot audit bytecode. Deploying unaudited code.');
      score += 60;
      questions.push('Has this contract been audited? By whom?');
    }
    if (license && /proprietary|closed/i.test(license)) {
      risks.push('Closed-source contract. Users must trust you completely.');
      score += 20;
    }
  }

  // ── Hire / agent-to-agent checks
  if (action_type === 'hire') {
    const { service, price, agent_id } = params || {};
    if (price && Number(price) > 10) {
      risks.push(`High payment ($${price}) for a single agent call. Verify reputation.`);
      score += 15;
    }
    if (agent_id && !context?.verified) {
      risks.push('Hiring unverified agent. No prior reputation data.');
      score += 10;
    }
  }

  // ── Generic common-sense checks
  if (!action_type) {
    risks.push('No action_type specified. Cannot apply specific risk rules.');
    score += 5;
  }
  if (context?.urgent === true) {
    risks.push('Action flagged as urgent. Urgency is a common social-engineering vector.');
    score += 15;
    questions.push('Why is this urgent? Is there time pressure from a real party?');
  }
  if (context?.first_time === true) {
    risks.push('First time performing this action. No prior data on outcomes.');
    score += 10;
  }

  // ── Verdict
  let verdict = 'PROCEED';
  if (score >= 70) verdict = 'ABORT';
  else if (score >= 30) verdict = 'REVIEW';

  // ── Confidence (lower if many unknowns)
  const unknowns = questions.length + (risks.length === 0 ? 1 : 0);
  const confidence = Math.max(0.3, Math.min(0.95, 1 - unknowns * 0.1 - score * 0.005));

  return {
    engine: 'rule',
    verdict,
    confidence: Number(confidence.toFixed(2)),
    score,
    risks,
    alternatives,
    adversarial_questions: questions,
    signals,
  };
}

// ── LLM upgrade (optional) ─────────────────────────────────────
function shouldUseLLM(input) {
  // Use LLM when the action is ambiguous or high-stakes
  const { action_type, params, context } = input;
  if (!action_type) return true;
  if (context?.urgent) return true;
  if (context?.first_time) return true;
  if (action_type === 'message' || action_type === 'send_message') return true;
  if (action_type === 'deploy') return true;
  if (action_type === 'hire') return true;
  return false;
}

async function llmReview(input, rule) {
  const prompt = `You are ReppS, an adversarial AI reviewer. Your job is to find what the requesting agent is missing or getting wrong about their planned action. Be specific, skeptical, and brief. Do NOT be agreeable. Push back.

Action: ${JSON.stringify(input, null, 2)}

Rule engine found these risks (treat as a starting point, add what's missing):
${JSON.stringify(rule, null, 2)}

Return JSON only with this shape:
{
  "verdict": "PROCEED|REVIEW|ABORT",
  "confidence": 0.0-1.0,
  "additional_risks": ["..."],
  "additional_questions": ["..."],
  "additional_alternatives": ["..."],
  "reasoning": "one paragraph"
}`;

  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: "You are ReppS — an adversarial reviewer. You find what's wrong, not what's right." },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  return JSON.parse(text);
}

// ── merge rule + llm ───────────────────────────────────────────
function mergeResults(input, rule, llm) {
  if (!llm) {
    return {
      check_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action_type: input.action_type,
      engine_used: 'rule',
      ...rule,
      reasoning: rule.risks.length
        ? `Rule engine flagged ${rule.risks.length} risk(s). Score ${rule.score}/100.`
        : 'Rule engine found no significant risks.',
    };
  }

  // Take the more conservative verdict
  const order = { PROCEED: 0, REVIEW: 1, ABORT: 2 };
  const verdict = order[llm.verdict] > order[rule.verdict] ? llm.verdict : rule.verdict;
  // Lower confidence of the two
  const confidence = Math.min(llm.confidence || 0.5, rule.confidence);

  return {
    check_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action_type: input.action_type,
    engine_used: 'rule+llm',
    verdict,
    confidence: Number(confidence.toFixed(2)),
    score: rule.score,
    risks: [...new Set([...rule.risks, ...(llm.additional_risks || [])])],
    alternatives: [...new Set([...rule.alternatives, ...(llm.additional_alternatives || [])])],
    adversarial_questions: [...new Set([...rule.adversarial_questions, ...(llm.additional_questions || [])])],
    reasoning: llm.reasoning || rule.reasoning,
    signals: rule.signals,
  };
}
