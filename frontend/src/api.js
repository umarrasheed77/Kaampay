/**
 * API Client with Demo Mode + Offline Fallback
 * 
 * GLOBAL DEMO RULE:
 * - demoMode=true → NO API calls, all from DEMO_DATA
 * - demoMode=false → try API, fallback to DEMO_DATA silently
 * 
 * safeFetch: max 2s timeout, on failure returns fallback silently
 */

import { DEMO_DATA, DEMO_VANI_OUTPUT, DEMO_HISAAB_OUTPUT, DEMO_PAISA_OUTPUT, DEMO_WORKER_HISTORY } from './demo_data';

const API_BASE = '/api';
const TIMEOUT_LIVE = 30000;  // 30s for live (Gemini can be slow)
const TIMEOUT_SAFE = 2000;   // 2s for non-critical fetches

async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT_LIVE) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/**
 * Safe fetch — tries API, returns fallback silently on failure.
 * Never throws to UI. Never shows error.
 */
async function safeFetch(url, fallback, options = {}, timeout = TIMEOUT_SAFE) {
  try {
    return await fetchWithTimeout(url, options, timeout);
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────
// Transcribe & Extract (VANI)
// ─────────────────────────────────────────

export async function apiTranscribe(text = null, demoMode = false) {
  if (demoMode) return DEMO_VANI_OUTPUT;

  try {
    const result = await fetchWithTimeout(`${API_BASE}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, audio_base64: null })
    });
    return result;
  } catch (e) {
    console.error('[API] Transcribe failed:', e.message);
    return DEMO_VANI_OUTPUT;
  }
}

// ─────────────────────────────────────────
// Process Payroll (HISAAB)
// ─────────────────────────────────────────

export async function apiProcessPayroll(vaniOutput, demoMode = false) {
  if (demoMode) return DEMO_HISAAB_OUTPUT;

  try {
    const result = await fetchWithTimeout(`${API_BASE}/process-payroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vaniOutput)
    });
    return result;
  } catch (e) {
    console.error('[API] Process payroll failed:', e.message);
    return DEMO_HISAAB_OUTPUT;
  }
}

// ─────────────────────────────────────────
// Balance Check (FIX 07)
// ─────────────────────────────────────────

export async function apiCheckBalance(total, demoMode = false) {
  if (demoMode) return { ...DEMO_DATA.balance_check, required: total };

  return safeFetch(
    `${API_BASE}/check-balance?total=${total}`,
    { ...DEMO_DATA.balance_check, required: total }
  );
}

// ─────────────────────────────────────────
// Execute Payments (PAISA + KAGAZ)
// ─────────────────────────────────────────

export async function apiExecutePayments(hisaabOutput, demoMode = false) {
  if (demoMode) return DEMO_PAISA_OUTPUT;

  try {
    const result = await fetchWithTimeout(`${API_BASE}/execute-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hisaabOutput)
    });
    return result;
  } catch (e) {
    console.error('[API] Payment failed:', e.message);
    return DEMO_PAISA_OUTPUT;
  }
}

// ─────────────────────────────────────────
// Worker Score (PAISA)
// ─────────────────────────────────────────

export async function apiWorkerScore(workerId, demoMode = false) {
  if (demoMode) {
    const score = DEMO_DATA.kaam_scores[workerId] || { score: 0, band: "building" };
    const history = DEMO_WORKER_HISTORY[workerId] || [];
    return { worker_id: workerId, score, history };
  }

  try {
    const result = await fetchWithTimeout(`${API_BASE}/worker-score/${workerId}`, {}, TIMEOUT_SAFE);
    return result;
  } catch {
    const score = DEMO_DATA.kaam_scores[workerId] || { score: 0, band: "building" };
    const history = DEMO_WORKER_HISTORY[workerId] || [];
    return { worker_id: workerId, score, history };
  }
}

// ─────────────────────────────────────────
// Contractor Dashboard (FIX 13)
// ─────────────────────────────────────────

export async function apiContractorSummary(demoMode = false) {
  if (demoMode) return DEMO_DATA.dashboard_summary;
  return safeFetch(`${API_BASE}/kaam/contractor/summary`, DEMO_DATA.dashboard_summary);
}

export async function apiRegisterWorker(workerData, demoMode = false) {
  if (demoMode) {
    const newWorkerId = `W_NEW_${workerData.name.substring(0,3).toUpperCase()}`;
    DEMO_DATA.dashboard_workers.unshift({
      worker_id: newWorkerId,
      name: workerData.name,
      kaam_score: 600,
      kaam_band: "building",
      total_days: 0,
      total_earned: 0,
      days_since_last_payment: 0
    });
    return {
      success: true,
      worker_id: newWorkerId,
      aadhaar_verified: true
    };
  }

  
  try {
    const res = await fetch(`${API_BASE}/register-worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: workerData.name,
        phone_number: workerData.phone_number,
        aadhaar_number: workerData.aadhaar_number,
        job_category: workerData.job_category || "unskilled"
      })
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function apiDailyTotals(demoMode = false) {
  if (demoMode) return { totals: DEMO_DATA.dashboard_daily_totals };
  return safeFetch(`${API_BASE}/kaam/contractor/daily-totals`, { totals: DEMO_DATA.dashboard_daily_totals });
}

export async function apiContractorWorkers(demoMode = false) {
  if (demoMode) return { workers: DEMO_DATA.dashboard_workers };
  return safeFetch(`${API_BASE}/kaam/contractor/workers`, { workers: DEMO_DATA.dashboard_workers });
}

export async function apiContractorInsights(demoMode = false) {
  if (demoMode) return { insights: DEMO_DATA.dashboard_insights };
  return safeFetch(`${API_BASE}/kaam/contractor/insights`, { insights: DEMO_DATA.dashboard_insights });
}

// ─────────────────────────────────────────
// Score Lookup (FIX 12)
// ─────────────────────────────────────────

export async function apiScoreLookup(aadhaarLast4, demoMode = false) {
  if (demoMode) {
    const worker = DEMO_DATA.dashboard_workers.find(w =>
      w.worker_id === "W003"
    );
    const score = DEMO_DATA.kaam_scores.W003;
    return {
      found: true, verified: true,
      worker_name: worker.name,
      kaam_score: score.score,
      kaam_band: score.band,
      loan_eligible_amount: score.loan_eligible,
      total_earned_90d: score.total_earned_90d
    };
  }

  // NOTE: the backend now enforces both of these for real (previously
  // a missing/malformed value here would still silently succeed):
  // - x-api-key must be a real, registered lender key
  // - aeps_verification_token must match the AEPS-<12+ chars> format
  return safeFetch(`${API_BASE}/kaam/score/lookup`, {}, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'demo-api-key-12345'
    },
    body: JSON.stringify({
      aadhaar_last4: aadhaarLast4,
      aeps_verification_token: "AEPS-DEMOFRONTENDTOKEN01",
      query_purpose: "credit_assessment"
    })
  });
}
