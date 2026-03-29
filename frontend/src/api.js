/**
 * API Client with Offline Fallback
 * Tries backend first → falls back to demo_data.js silently.
 * Demo NEVER breaks.
 */

import { DEMO_VANI_OUTPUT, DEMO_HISAAB_OUTPUT, DEMO_PAISA_OUTPUT, DEMO_WORKER_HISTORY } from './demo_data';

const API_BASE = '/api';
const TIMEOUT = 5000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/**
 * Transcribe & Extract (VANI)
 */
export async function apiTranscribe(text = null) {
  try {
    const result = await fetchWithTimeout(`${API_BASE}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, audio_base64: null })
    });
    return result;
  } catch (e) {
    console.warn('[API] Transcribe failed, using demo data:', e.message);
    return DEMO_VANI_OUTPUT;
  }
}

/**
 * Process Payroll (HISAAB)
 */
export async function apiProcessPayroll(vaniOutput) {
  try {
    const result = await fetchWithTimeout(`${API_BASE}/process-payroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vaniOutput)
    });
    return result;
  } catch (e) {
    console.warn('[API] Process payroll failed, using demo data:', e.message);
    return DEMO_HISAAB_OUTPUT;
  }
}

/**
 * Execute Payments (PAISA + KAGAZ)
 */
export async function apiExecutePayments(hisaabOutput) {
  try {
    const result = await fetchWithTimeout(`${API_BASE}/execute-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hisaabOutput)
    });
    return result;
  } catch (e) {
    console.warn('[API] Execute payments failed, using demo data:', e.message);
    return DEMO_PAISA_OUTPUT;
  }
}

/**
 * Get Worker Score (PAISA)
 */
export async function apiWorkerScore(workerId) {
  try {
    const result = await fetchWithTimeout(`${API_BASE}/worker-score/${workerId}`);
    return result;
  } catch (e) {
    console.warn('[API] Worker score failed, using demo data:', e.message);
    const score = DEMO_PAISA_OUTPUT.scores[workerId] || { score: 0, band: "building" };
    const history = DEMO_WORKER_HISTORY[workerId] || [];
    return { worker_id: workerId, score, history };
  }
}
