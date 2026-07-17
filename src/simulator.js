// tx_simulator — adversarial dry-run of a planned onchain transaction.
// Returns a probabilistic simulation of how the tx would execute on X Layer,
// including MEV exposure, common failure modes, and safer alternative routes.
//
// Like review() in adversarial.js but tx-specific: deeper on the mechanics
// (gas, slippage, MEV sandwich risk, revert probability) instead of
// general "what could go wrong" reasoning.
//
// Two modes:
//   1. Rule engine (always works, no external API)
//   2. GoPlus Security API for token contract risk (optional, requires env)
//
// The output shape matches the rest of ReppS so agents can consume it
// uniformly: {check_id, verdict, confidence, risks[], alternatives[], ...}

import crypto from 'node:crypto';

const GOPLUS_KEY = process.env.GOPLUS_API_KEY || null;
const GOPLUS_URL = 'https://api.gopluslabs.io/api/v1';

// X Layer mainnet chain id for GoPlus is 196
const XL_CHAIN_ID = '196';

// ── entry point ────────────────────────────────────────────────
export async function simulate(input) {
  const rule = ruleEngine(input);
  const goplus = await goplusCheck(input).catch((e) => {
    console.warn('[repps] goplus check failed:', e.message);
    return null;
  });
  return merge(input, rule, goplus);
}

// ── rule engine ────────────────────────────────────────────────
function ruleEngine(input) {
  const { action_type, params, context } = normalize(input);
  const risks = [];
  const alternatives = [];
  let success_probability = 0.95; // start optimistic
  let gas_estimate_usdt = 0.005; // base X Layer transfer
  let mev_risk = 'none';
  let flags = [];

  // ── DEX swap analysis ──
  if (action_type === 'swap' || action_type === 'dex_swap' || action_type === 'swap_exact_tokens_for_tokens') {
    const { token_in, token_out, amount_in, amount_out_min, slippage_bps, router, deadline_seconds } = params;

    // Slippage analysis
    if (slippage_bps !== undefined) {
      if (slippage_bps > 500) {
        risks.push({
          severity: 'high',
          category: 'slippage',
          message: `Slippage tolerance is ${(slippage_bps / 100).toFixed(1)}% — wide. Vulnerable to sandwich attacks; you'll lose ~${(slippage_bps / 100).toFixed(1)}% of trade value to MEV bots.`,
        });
        mev_risk = 'high';
        success_probability -= 0.15;
      } else if (slippage_bps > 200) {
        risks.push({
          severity: 'medium',
          category: 'slippage',
          message: `Slippage tolerance is ${(slippage_bps / 100).toFixed(1)}% — above market norm (0.5-1%). Consider tightening to 100 bps.`,
        });
        mev_risk = 'medium';
        success_probability -= 0.05;
      } else if (slippage_bps > 50) {
        mev_risk = 'low';
      }
    } else {
      risks.push({
        severity: 'medium',
        category: 'slippage',
        message: 'No slippage tolerance specified. Default router behavior (often 1-5%) will be used — set explicitly to protect against MEV.',
      });
      success_probability -= 0.1;
    }

    // Amount analysis
    if (amount_in !== undefined) {
      const amt = Number(amount_in);
      if (amt > 100000) {
        // Large trade — likely to move market
        risks.push({
          severity: 'medium',
          category: 'price_impact',
          message: `Trade size of ${amt} is large. Price impact likely >2% on most pairs. Consider splitting or using a TWAP.`,
        });
        success_probability -= 0.1;
      } else if (amt < 1) {
        // Dust — likely to revert due to gas exceeding value
        risks.push({
          severity: 'high',
          category: 'dust',
          message: `Trade size of ${amt} is below dust threshold. Gas cost (~$0.005) will exceed trade value. Will revert.`,
        });
        success_probability -= 0.7;
      }
    }

    // Deadline analysis
    if (deadline_seconds !== undefined) {
      if (deadline_seconds < 60) {
        risks.push({
          severity: 'low',
          category: 'deadline',
          message: `Deadline of ${deadline_seconds}s is short. Network congestion could cause revert.`,
        });
        success_probability -= 0.05;
      } else if (deadline_seconds > 1800) {
        risks.push({
          severity: 'low',
          category: 'deadline',
          message: `Deadline of ${deadline_seconds}s (${(deadline_seconds/60).toFixed(0)}min) is long. You're exposed to price movement for that window.`,
        });
      }
    }

    // Token pair risk
    if (token_in && token_out) {
      if (token_in === token_out) {
        risks.push({
          severity: 'high',
          category: 'invalid_pair',
          message: 'Token in = Token out. This will revert.',
        });
        success_probability = 0;
      }
      // Common scam patterns
      const scamPatterns = [
        /airdrop/i, /claim/i, /visit/i, /http:\/\//i,
      ];
      const isScammy = scamPatterns.some((p) => p.test(token_in) || p.test(token_out));
      if (isScammy) {
        flags.push('possible_phishing_token');
        risks.push({
          severity: 'critical',
          category: 'scam',
          message: 'Token symbol contains suspicious patterns (airdrop/claim/http). Likely a phishing token. Do not approve.',
        });
        success_probability = 0;
      }
    }

    // Router analysis
    if (router) {
      const knownRouters = {
        '0x1c8c4f9d': 'OKX Swap Router',
        '0x80a0877c': 'X Layer Swap',
      };
      const routerName = knownRouters[router?.toLowerCase?.()] || null;
      if (routerName) {
        alternatives.push({
          type: 'route',
          name: routerName,
          hint: `Using known router ${routerName}.`,
        });
      } else {
        flags.push('unverified_router');
        risks.push({
          severity: 'medium',
          category: 'router',
          message: `Router ${router} is not in our verified list. Verify on X Layer explorer (okx.com/explorer/xlayer) before approving.`,
        });
        success_probability -= 0.15;
      }
    }

    gas_estimate_usdt = 0.015; // swap costs more than transfer
  }

  // ── Token transfer ──
  else if (action_type === 'transfer' || action_type === 'send' || action_type === 'erc20_transfer') {
    const { to, amount, token } = params;

    // Address analysis
    if (to) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
        risks.push({
          severity: 'critical',
          category: 'invalid_address',
          message: `Recipient address "${to}" is not a valid EVM address. Tx will revert.`,
        });
        success_probability = 0;
      } else if (to.toLowerCase() === '0x0000000000000000000000000000000000000000') {
        risks.push({
          severity: 'critical',
          category: 'burn',
          message: 'Recipient is 0x0 (burn address). Funds will be lost forever.',
        });
        success_probability = 0.5;
      } else if (to.toLowerCase() === '0xdead000000000000000000000000000000000000') {
        risks.push({
          severity: 'critical',
          category: 'burn',
          message: 'Recipient is 0xdead. Funds will be sent to a known burn address.',
        });
        success_probability = 0.5;
      }
    } else {
      risks.push({
        severity: 'critical',
        category: 'missing_recipient',
        message: 'No recipient address specified.',
      });
      success_probability = 0;
    }

    // Amount
    if (amount !== undefined) {
      const amt = Number(amount);
      if (amt <= 0) {
        risks.push({
          severity: 'high',
          category: 'invalid_amount',
          message: 'Transfer amount is 0 or negative.',
        });
        success_probability = 0;
      }
    }

    gas_estimate_usdt = 0.008;
  }

  // ── Token approval ──
  else if (action_type === 'approve' || action_type === 'erc20_approve') {
    const { token, spender, amount } = params;

    // Unlimited approval is risky
    const MAX_UINT256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
    if (amount === MAX_UINT256 || amount === 'unlimited' || amount === '-1') {
      risks.push({
        severity: 'high',
        category: 'unlimited_approval',
        message: 'Unlimited token approval. If the spender contract is exploited or malicious, it can drain your entire token balance at any time. Prefer approving only the amount needed.',
      });
      success_probability -= 0.05;
      flags.push('unlimited_approval');
    }

    // Spender analysis
    if (spender) {
      if (spender.toLowerCase() === '0x0000000000000000000000000000000000000000') {
        risks.push({
          severity: 'critical',
          category: 'zero_spender',
          message: 'Approving the zero address. This is a common scam pattern — funds may be locked or stolen.',
        });
        success_probability = 0;
      }
    }

    gas_estimate_usdt = 0.006;
  }

  // ── Contract interaction (generic) ──
  else if (action_type === 'contract_call' || action_type === 'call' || action_type === 'interact') {
    const { contract, method, value } = params;

    if (contract && !/^0x[a-fA-F0-9]{40}$/.test(contract)) {
      risks.push({
        severity: 'critical',
        category: 'invalid_contract',
        message: 'Contract address is not a valid EVM address.',
      });
      success_probability = 0;
    }

    risks.push({
      severity: 'medium',
      category: 'unknown_outcome',
      message: `Generic contract call to ${method || 'unknown method'}. Outcome cannot be simulated without the contract ABI. Verify on a block explorer before sending value (${value || '0'} wei).`,
    });
    success_probability -= 0.1;

    if (value && Number(value) > 0) {
      flags.push('sends_value');
      risks.push({
        severity: 'medium',
        category: 'value_transfer',
        message: 'This call sends native value. Confirm you trust the recipient contract.',
      });
    }

    gas_estimate_usdt = 0.05; // unknown
  }

  // ── Bridge ──
  else if (action_type === 'bridge') {
    risks.push({
      severity: 'medium',
      category: 'bridge_risk',
      message: 'Cross-chain bridges are high-value targets for exploits. Verify the bridge contract on both source and destination chains.',
    });
    success_probability -= 0.1;
    flags.push('cross_chain');
    gas_estimate_usdt = 0.05;
  }

  // ── Unknown action type ──
  else {
    risks.push({
      severity: 'low',
      category: 'unknown_type',
      message: `Action type "${action_type}" is not specifically supported by the simulator. Run the generic review for a broader risk scan.`,
    });
    success_probability = 0.9;
  }

  // ── Common context checks ──
  if (context) {
    if (context.wallet_balance_usdt !== undefined && context.wallet_balance_usdt < gas_estimate_usdt * 2) {
      risks.push({
        severity: 'high',
        category: 'insufficient_gas',
        message: `Wallet balance (${context.wallet_balance_usdt} USDT) is below 2x gas cost (${(gas_estimate_usdt*2).toFixed(4)} USDT). Tx will fail with "insufficient funds for gas".`,
      });
      success_probability = 0;
    }

    if (context.urgent === true) {
      risks.push({
        severity: 'medium',
        category: 'urgency',
        message: 'Action is marked urgent. Urgency is a known social-engineering trigger. Step back and confirm the action is what you want, not what someone pressured you into.',
      });
    }

    if (context.first_time === true) {
      risks.push({
        severity: 'medium',
        category: 'unfamiliarity',
        message: 'First time interacting with this action type / recipient. Consider doing a small test tx first.',
      });
    }
  }

  // ── Compute verdict ──
  success_probability = Math.max(0, Math.min(1, success_probability));
  let verdict;
  if (success_probability < 0.3 || flags.includes('possible_phishing_token')) {
    verdict = 'ABORT';
  } else if (success_probability < 0.7 || risks.some((r) => r.severity === 'high')) {
    verdict = 'REVIEW';
  } else {
    verdict = 'PROCEED';
  }

  // ── Suggest alternatives ──
  if (mev_risk === 'high' && action_type?.includes('swap')) {
    alternatives.push({
      type: 'route_split',
      hint: 'Split trade across 2-3 transactions over 5-10 min to reduce sandwich attack surface.',
    });
    alternatives.push({
      type: 'private_mempool',
      hint: 'Use a private mempool (e.g., Flashbots Protect equivalent on X Layer) to hide tx from public mempool.',
    });
  }
  if (flags.includes('unlimited_approval')) {
    alternatives.push({
      type: 'exact_approval',
      hint: 'Approve only the exact amount needed, not unlimited. Use a helper like permit2 for batch approvals.',
    });
  }

  return {
    verdict,
    confidence: 0.85,
    success_probability,
    gas_estimate_usdt,
    mev_risk,
    risks,
    alternatives,
    flags,
    action_type: action_type || 'unknown',
  };
}

// ── GoPlus token security check (optional) ──
async function goplusCheck(input) {
  if (!GOPLUS_KEY) return null;
  const tokenAddr = input?.params?.token_in || input?.params?.token || input?.params?.token_address;
  if (!tokenAddr || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddr)) return null;

  try {
    const url = `${GOPLUS_URL}/token_security/${XL_CHAIN_ID}?contract_addresses=${tokenAddr}`;
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${GOPLUS_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const result = data?.result?.[tokenAddr.toLowerCase()];
    if (!result) return null;

    const findings = [];
    if (result.is_honeypot === '1') {
      findings.push({ severity: 'critical', category: 'honeypot', message: 'GoPlus flags this token as a honeypot — sells will be blocked or taxed 100%.' });
    }
    if (result.cannot_sell_all === '1') {
      findings.push({ severity: 'high', category: 'sell_restriction', message: 'Cannot sell all of this token. Some balance is locked.' });
    }
    if (result.transfer_pausable === '1') {
      findings.push({ severity: 'high', category: 'pausable', message: 'Token transfers can be paused by the owner at any time.' });
    }
    if (result.is_mintable === '1') {
      findings.push({ severity: 'medium', category: 'mintable', message: 'Owner can mint new tokens, diluting your holdings.' });
    }
    if (result.slippage_modifiable === '1') {
      findings.push({ severity: 'high', category: 'modifiable_tax', message: 'Owner can modify sell tax. Could be set to 99% after you buy.' });
    }
    if (result.is_blacklisted === '1') {
      findings.push({ severity: 'high', category: 'blacklist', message: 'Token has blacklist functionality. Owner can freeze your balance.' });
    }
    if (result.buy_tax && Number(result.buy_tax) > 10) {
      findings.push({ severity: 'high', category: 'high_buy_tax', message: `Buy tax is ${result.buy_tax}%. Sticker shock ahead.` });
    }
    if (result.sell_tax && Number(result.sell_tax) > 10) {
      findings.push({ severity: 'high', category: 'high_sell_tax', message: `Sell tax is ${result.sell_tax}%. You'll lose ${result.sell_tax}% on exit.` });
    }
    if (result.holder_count && Number(result.holder_count) < 100) {
      findings.push({ severity: 'medium', category: 'low_distribution', message: `Only ${result.holder_count} holders. Highly concentrated, easy to dump.` });
    }
    if (result.owner_address && result.owner_address !== '0x0000000000000000000000000000000000000000') {
      findings.push({ severity: 'low', category: 'not_renounced', message: 'Contract ownership is not renounced. Owner retains admin powers.' });
    }

    return {
      source: 'goplus',
      token_address: tokenAddr,
      findings,
    };
  } catch (e) {
    return null;
  }
}

// ── merge rule + goplus ──
function merge(input, rule, goplus) {
  const all_risks = [...rule.risks];
  const all_flags = [...(rule.flags || [])];

  if (goplus && goplus.findings) {
    for (const f of goplus.findings) {
      all_risks.push({ ...f, source: 'goplus' });
      if (f.category === 'honeypot') all_flags.push('goplus_honeypot');
    }
  }

  // Honeypot from GoPlus overrides verdict
  let verdict = rule.verdict;
  if (all_flags.includes('goplus_honeypot')) verdict = 'ABORT';

  return {
    check_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action_type: rule.action_type,
    verdict,
    confidence: goplus ? Math.min(0.95, rule.confidence + 0.05) : rule.confidence,
    success_probability: rule.success_probability,
    gas_estimate_usdt: rule.gas_estimate_usdt,
    mev_risk: rule.mev_risk,
    risks: all_risks,
    alternatives: rule.alternatives,
    flags: all_flags,
    sources: ['rule-engine', ...(goplus ? ['goplus'] : [])],
    summary: buildSummary(verdict, rule, goplus),
    upgrade_hint: 'For deeper reasoning (adversarial questions, edge cases), use /api/challenge ($0.01).',
  };
}

function buildSummary(verdict, rule, goplus) {
  if (verdict === 'ABORT') {
    const critical = rule.risks.find((r) => r.severity === 'critical');
    return `ABORT: ${critical ? critical.message : 'Critical risk detected.'}`;
  }
  if (verdict === 'REVIEW') {
    return `REVIEW: ${rule.risks.length} risk(s) found, success probability ${(rule.success_probability*100).toFixed(0)}%.`;
  }
  return `PROCEED: Low risk. Success probability ${(rule.success_probability*100).toFixed(0)}%, gas ~$${rule.gas_estimate_usdt.toFixed(4)}.`;
}

// ── normalize input ──
function normalize(input) {
  return {
    action_type: input.action_type || input.type || 'unknown',
    params: input.params || input.parameters || input.details || {},
    context: input.context || {},
  };
}
