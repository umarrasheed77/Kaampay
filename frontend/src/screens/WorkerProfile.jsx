import React, { useState, useEffect } from 'react';
import { apiWorkerScore } from '../api';
import { DEMO_PAISA_OUTPUT, DEMO_WORKER_HISTORY } from '../demo_data';

/**
 * Screen 5: Worker Profile / MazdoorScore
 * THE SECOND EMOTIONAL PEAK — the credit identity.
 * Shows score, eligibility, payslip history, download.
 */

const ELIGIBILITY_ICONS = {
  loan: "💰",
  insurance: "🛡️",
  scheme: "🏛️",
  bank: "🏦"
};

export default function WorkerProfile({ worker, paisaOutput, onBack, onHome }) {
  const [scoreData, setScoreData] = useState(null);
  const [history, setHistory] = useState([]);
  const [animateScore, setAnimateScore] = useState(false);

  useEffect(() => {
    if (!worker) return;

    const loadData = async () => {
      try {
        const result = await apiWorkerScore(worker.worker_id);
        setScoreData(result.score);
        setHistory(result.history || []);
      } catch {
        // Fallback
        setScoreData(DEMO_PAISA_OUTPUT.scores[worker.worker_id] || { score: 0, band: "building" });
        setHistory(DEMO_WORKER_HISTORY[worker.worker_id] || []);
      }

      // Trigger score animation after brief delay
      setTimeout(() => setAnimateScore(true), 300);
    };

    loadData();
  }, [worker]);

  if (!worker || !scoreData) return null;

  const scorePercent = animateScore ? (scoreData.score / 850) * 100 : 0;

  return (
    <div className="screen" style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div className="header" style={{ margin: '-32px -20px 0', borderRadius: 0 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: 'white',
            fontSize: '1.25rem', cursor: 'pointer', padding: '8px'
          }}
        >
          ←
        </button>
        <div className="header-text" style={{ flex: 1 }}>
          <h1>Worker Profile</h1>
          <p>मज़दूर प्रोफाइल</p>
        </div>
      </div>

      {/* Worker Info Card */}
      <div className="card card-elevated mt-6" style={{
        background: 'linear-gradient(135deg, var(--green-50), var(--white))',
        textAlign: 'center',
        padding: '24px 20px'
      }}>
        {/* Avatar */}
        <div className="worker-avatar large" style={{ margin: '0 auto' }}>
          {worker.worker_name.split(' ').map(n => n[0]).join('')}
        </div>

        <h2 style={{ marginTop: '12px', fontSize: '1.375rem' }}>{worker.worker_name}</h2>
        <p className="text-xs text-gray" style={{ marginTop: '2px' }}>
          Aadhaar: •••• {worker.aadhaar_last4}
        </p>
        <p className="text-sm" style={{
          fontFamily: 'var(--font-hi)',
          color: 'var(--green-600)',
          marginTop: '4px'
        }}>
          {scoreData.days_in_system} din se MazdoorPay par
        </p>
        <p className="text-xs text-gray">
          {scoreData.days_in_system} days on MazdoorPay
        </p>
      </div>

      {/* MazdoorScore Section */}
      <div className="card mt-4 p-4">
        <div className="bilingual mb-3">
          <p className="en text-sm">MazdoorScore</p>
          <p className="hi">मज़दूर स्कोर</p>
        </div>

        {/* Score Number */}
        <div className="flex items-center gap-3 mb-3">
          <span className="score-number">{scoreData.score}</span>
          <div>
            <span className={`score-band ${scoreData.band}`}>{scoreData.band}</span>
            <p className="text-xs text-gray mt-1">out of 850</p>
          </div>
        </div>

        {/* Score Bar with band markers */}
        <div style={{ position: 'relative' }}>
          <div className="score-bar-track">
            <div className="score-bar-fill" style={{ width: `${scorePercent}%` }} />
          </div>
          {/* Band markers */}
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray">0</span>
            <span className="text-xs text-gray" style={{ position: 'absolute', left: '35.3%' }}>300</span>
            <span className="text-xs text-gray" style={{ position: 'absolute', left: '58.8%' }}>500</span>
            <span className="text-xs text-gray" style={{ position: 'absolute', left: '76.5%' }}>650</span>
            <span className="text-xs text-gray">850</span>
          </div>
        </div>

        {/* Progress to next band */}
        {scoreData.progress_to_next_band && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: 'var(--green-50)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem'
          }}>
            <span style={{ color: 'var(--green-700)' }}>
              {scoreData.progress_to_next_band.points_needed} points to <strong>{scoreData.progress_to_next_band.next_band}</strong>
            </span>
          </div>
        )}

        {/* Score Factors */}
        {scoreData.factors && scoreData.factors.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray mb-2" style={{ fontWeight: 600 }}>Score Breakdown</p>
            <div className="flex flex-col gap-2">
              {scoreData.factors.map((factor, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs">{factor.name}</span>
                    <span className="text-xs text-gray">{factor.value}/{factor.max}</span>
                  </div>
                  <div className="score-bar-track" style={{ height: '4px' }}>
                    <div className="score-bar-fill" style={{
                      width: animateScore ? `${(factor.value / factor.max) * 100}%` : '0%',
                      transitionDelay: `${i * 0.15}s`
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Eligibility Section */}
      <div className="mt-4">
        <div className="bilingual mb-3">
          <p className="en text-sm font-semibold" style={{ color: 'var(--green-700)' }}>
            You are eligible for
          </p>
          <p className="hi">Aap eligible hain</p>
        </div>

        <div className="flex flex-col gap-2">
          {(scoreData.eligibility || []).map((item, i) => (
            <div key={i} className="eligibility-card" style={{
              animation: 'screenFadeIn 0.4s ease',
              animationDelay: `${i * 0.1}s`,
              animationFillMode: 'backwards'
            }}>
              <div className={`eligibility-icon ${item.icon}`}>
                {ELIGIBILITY_ICONS[item.icon] || "📋"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs" style={{ fontFamily: 'var(--font-hi)', color: 'var(--gray-500)' }}>
                  {item.name_hindi}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-green">{item.amount}</span>
                  <span className="text-xs text-gray">• {item.provider}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment History Timeline */}
      <div className="mt-6">
        <div className="bilingual mb-3">
          <p className="en text-sm font-semibold">Recent Payslips</p>
          <p className="hi">Haal ki payslips</p>
        </div>

        <div className="card p-3">
          {history.slice(0, 8).map((record, i) => (
            <div key={i} className="timeline-item">
              <div className="timeline-dot" />
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold">{record.date}</p>
                  <p className="text-xs text-gray">
                    {record.days_worked} day{record.days_worked !== 1 ? 's' : ''} • ₹{record.rate_per_day}/day
                  </p>
                </div>
                <p className="text-sm font-bold text-green">₹{record.gross_pay.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Earnings Summary */}
      {scoreData.total_earned_90d && (
        <div className="card mt-4 p-4" style={{
          background: 'linear-gradient(135deg, var(--amber-50), var(--white))',
          border: '1px solid var(--amber-300)'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray">Last 90 days earnings</p>
              <p className="text-xs" style={{ fontFamily: 'var(--font-hi)', color: 'var(--gray-500)' }}>
                Pichhle 90 din ki kamaai
              </p>
            </div>
            <p style={{
              fontSize: '1.5rem', fontWeight: 800,
              color: 'var(--green-700)', letterSpacing: '-0.02em'
            }}>
              ₹{scoreData.total_earned_90d.toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-gray mt-1">
            {scoreData.total_days_worked_90d} days worked • {scoreData.message}
          </p>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex flex-col gap-2 mt-6">
        <button className="btn btn-primary btn-full" onClick={onBack} id="back-to-payments">
          ← Back to Payments
        </button>
        <button className="btn btn-outline btn-full" onClick={onHome} id="new-payroll">
          <span>🎙️</span>
          <span>New Payroll</span>
          <span style={{ fontFamily: 'var(--font-hi)', fontSize: '0.85em', opacity: 0.7 }}>
            नई पेरोल
          </span>
        </button>
      </div>
    </div>
  );
}
