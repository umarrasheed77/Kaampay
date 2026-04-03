import React, { useState, useEffect } from 'react';
import { DEMO_DATA } from '../demo_data';
import KaamScoreRing from '../components/KaamScoreRing';
import { useGlobalState } from '../context/GlobalState';

export default function CreditScoreScreen({ onNavigate, workerId = 'W003' }) {
  const { state } = useGlobalState();
  
  // Find worker from global state first, then demo data
  const stateWorker = state.workers.find(w => w.id === workerId);
  const demoWorker = DEMO_DATA.payroll_entries.find(w => w.worker_id === workerId);
  
  const workerData = {
    worker_id: workerId,
    worker_name: stateWorker?.name || demoWorker?.worker_name || 'Worker',
    aadhaar_last4: demoWorker?.aadhaar_last4 || stateWorker?.aadhaar_last4 || 'XXXX',
    phone_type: demoWorker?.phone_type || stateWorker?.phone_type || 'feature_phone',
  };

  const workerScore = stateWorker?.kaam_score || 350;
  
  // Use demo profile if available, otherwise generate a default one
  const profile = DEMO_DATA.kaam_scores[workerId] || {
    score: workerScore,
    band: workerScore >= 600 ? 'established' : workerScore >= 400 ? 'developing' : 'basic',
    days_in_system: stateWorker ? Math.max(1, Math.floor((Date.now() - (stateWorker.joinedAt || Date.now())) / 86400000)) : 1,
    total_earned_90d: Math.round(workerScore * 40),
    loan_eligible: workerScore >= 600 ? '₹25,000' : workerScore >= 400 ? '₹10,000' : '₹2,000',
    benefits: workerScore >= 600
      ? ['₹25,000 business loan', 'PM Vishwakarma scheme', 'PM Suraksha Bima insurance']
      : workerScore >= 400
        ? ['₹10,000 personal loan', 'PMJJBY life insurance (₹330/year)', 'Ration card linkage support']
        : ['₹2,000 emergency loan'],
    score_history: Array.from({ length: 12 }, (_, i) => Math.max(280, workerScore - (12 - i) * 5)),
  };

  const [showDetails, setShowDetails] = useState(false);
  const [animStep, setAnimStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimStep(1), 300);
    const t2 = setTimeout(() => setAnimStep(2), 600);
    const t3 = setTimeout(() => setAnimStep(3), 900);
    const t4 = setTimeout(() => setShowDetails(true), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);


  const getBandDetails = (band) => {
    switch (band) {
      case 'established': return { label: 'Established', color: '#0ea56c', bg: '#e6f9f0', emoji: '🏆', desc: 'Proven track record' };
      case 'developing': return { label: 'Developing', color: '#00BAF2', bg: '#e0f5fd', emoji: '📈', desc: 'Building credit history' };
      default: return { label: 'Basic', color: '#f59e0b', bg: '#fff8e6', emoji: '🌱', desc: 'Getting started' };
    }
  };

  const bandConfig = getBandDetails(profile.band);
  const scoreHistory = profile.score_history || [];
  const maxHistScore = Math.max(...scoreHistory, 1);
  const loanOffer = profile.loan_offer;

  // Compute reliability & consistency from demo data
  const reliability = workerId === 'W003' ? 96 : workerId === 'W001' ? 82 : 65;
  const consistency = workerId === 'W003' ? 94 : workerId === 'W001' ? 78 : 58;
  const avgMonthly = Math.round(profile.total_earned_90d / 3);

  // Score breakdown factors
  const factors = [
    { label: 'Payment Regularity', value: reliability, max: 100, icon: '📊', color: '#0ea56c' },
    { label: 'Attendance Rate', value: consistency, max: 100, icon: '📅', color: '#00BAF2' },
    { label: 'Days in System', value: Math.min(profile.days_in_system, 90), max: 90, icon: '⏳', color: '#8b5cf6' },
    { label: 'Verified Payments', value: Math.round(profile.total_earned_90d / 700), max: 60, icon: '✅', color: '#f59e0b' },
  ];

  return (
    <div className="screen-body" style={{ padding: 0, paddingBottom: 80, minHeight: '100vh', background: '#f4f6fb' }}>

      {/* ── HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1442 0%, #1a2475 60%, #2d3a8c 100%)',
        padding: '16px 16px 40px', color: 'white',
        borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: 'rgba(0,186,242,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(14,165,108,0.06)' }} />
        <div style={{ position: 'absolute', top: 20, right: 60, width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ position: 'absolute', top: 50, right: 30, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />

        <div className="flex items-center gap-3" style={{ position: 'relative', zIndex: 2 }}>
          <button className="tappable" onClick={() => onNavigate('5')} style={{ color: 'white', fontSize: 20, background: 'rgba(255,255,255,0.1)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="title" style={{ fontSize: 20, fontWeight: 700 }}>KaamScore Report</h1>
            <div style={{ fontSize: 12, color: '#7b8fcb', marginTop: 2 }}>Credit Worthiness Assessment</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 10px', fontSize: 11, color: '#7b8fcb' }}>
            🔒 Verified
          </div>
        </div>

        {/* Worker Identity */}
        <div style={{
          marginTop: 20, display: 'flex', alignItems: 'center', gap: 14,
          background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '14px 16px',
          backdropFilter: 'blur(8px)', position: 'relative', zIndex: 2,
          opacity: animStep >= 1 ? 1 : 0, transform: animStep >= 1 ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #00BAF2, #0ea56c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, color: 'white',
            boxShadow: '0 4px 12px rgba(0,186,242,0.3)'
          }}>
            {workerData.worker_name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{workerData.worker_name}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              Aadhaar ••••{workerData.aadhaar_last4} • UPI Verified
            </div>
          </div>
          <div style={{
            background: bandConfig.bg, color: bandConfig.color,
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700
          }}>
            {bandConfig.emoji} {bandConfig.label}
          </div>
        </div>
      </div>

      <div style={{ padding: 16, marginTop: -24, position: 'relative', zIndex: 10 }}>

        {/* ── SCORE HERO CARD ── */}
        <div className="card" style={{
          padding: 28, textAlign: 'center', marginBottom: 16,
          background: 'white', border: '1px solid rgba(0,186,242,0.1)',
          opacity: animStep >= 2 ? 1 : 0, transform: animStep >= 2 ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.1em', marginBottom: 16 }}>
            CREDIT SCORE
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <KaamScoreRing score={profile.score} />
          </div>

          {/* Score Scale */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 8px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 30%, #00BAF2 60%, #0ea56c 100%)', transform: 'translateY(-50%)' }} />
            <div style={{
              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
              left: `${Math.min((profile.score / 900) * 100, 100)}%`,
              width: 14, height: 14, borderRadius: '50%', background: 'white',
              border: `3px solid ${bandConfig.color}`, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transition: 'left 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              marginLeft: -7, zIndex: 2
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginTop: 12, padding: '0 4px' }}>
            <span>0</span><span>300</span><span>500</span><span>700</span><span>900</span>
          </div>

          <div style={{ marginTop: 16, fontSize: 13, color: '#475569' }}>
            {bandConfig.desc} — Eligible for up to <strong style={{ color: bandConfig.color }}>{profile.loan_eligible}</strong> in credit
          </div>
        </div>

        {/* ── SCORE TREND ── */}
        <div className="card" style={{
          padding: 20, marginBottom: 16,
          opacity: animStep >= 3 ? 1 : 0, transform: animStep >= 3 ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Score Trend</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Last {scoreHistory.length} checkpoints</div>
            </div>
            <div style={{
              background: profile.score > scoreHistory[0] ? '#e6f9f0' : '#fff0f0',
              color: profile.score > scoreHistory[0] ? '#0ea56c' : '#ef4444',
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700
            }}>
              {profile.score > scoreHistory[0] ? '↑' : '↓'} +{profile.score - scoreHistory[0]} pts
            </div>
          </div>

          {/* Mini Chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {scoreHistory.slice(-14).map((s, i, arr) => (
              <div key={i} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end'
              }}>
                <div style={{
                  width: '100%', borderRadius: '3px 3px 0 0',
                  background: i === arr.length - 1
                    ? `linear-gradient(180deg, ${bandConfig.color}, ${bandConfig.color}88)`
                    : '#e5e9f5',
                  height: `${Math.max((s / maxHistScore) * 100, 8)}%`,
                  transition: 'height 0.8s ease',
                  transitionDelay: `${i * 40}ms`,
                  minHeight: 4
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: '#9ca3af' }}>
            <span>Oldest</span><span>Latest</span>
          </div>
        </div>

        {/* ── SCORE FACTORS ── */}
        {showDetails && (
          <div style={{ animation: 'fadeSlideUp 0.5s ease both' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Score Factors</div>
            <div className="flex flex-col gap-3" style={{ marginBottom: 16 }}>
              {factors.map((f, i) => {
                const pct = Math.min((f.value / f.max) * 100, 100);
                return (
                  <div key={i} className="card" style={{ padding: '14px 16px' }}>
                    <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>{f.icon}</span>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827' }}>{f.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.value}/{f.max}</div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: `linear-gradient(90deg, ${f.color}88, ${f.color})`,
                        width: `${pct}%`, transition: 'width 1s ease', transitionDelay: `${i * 150}ms`
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── FINANCIAL SNAPSHOT ── */}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Financial Snapshot</div>
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              {[
                { label: 'Verified Income (90d)', value: `₹${profile.total_earned_90d.toLocaleString()}`, color: '#111827' },
                { label: 'Avg. Monthly Income', value: `₹${avgMonthly.toLocaleString()}`, color: '#111827' },
                { label: 'Days Active', value: `${profile.days_in_system} days`, color: '#111827' },
                { label: 'Income Source', value: 'UPI Verified Payroll', color: '#0ea56c', highlight: true },
                { label: 'Credit Eligible', value: profile.loan_eligible, color: '#00BAF2', highlight: true },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center" style={{
                  padding: '10px 0',
                  borderBottom: i < 4 ? '0.5px solid #f1f5f9' : 'none'
                }}>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{row.label}</div>
                  <div style={{
                    fontSize: 13, fontWeight: row.highlight ? 700 : 600, color: row.color
                  }}>{row.value}</div>
                </div>
              ))}
            </div>

            {/* ── BENEFITS UNLOCKED ── */}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Benefits Unlocked</div>
            <div className="flex flex-col gap-2" style={{ marginBottom: 16 }}>
              {profile.benefits.map((benefit, i) => (
                <div key={i} className="card" style={{
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  background: i === 0 ? 'linear-gradient(135deg, #f0fdf4, #e6f9f0)' : 'white',
                  border: i === 0 ? '1px solid #bbf7d0' : '1px solid #f1f5f9'
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: i === 0 ? '#0ea56c' : '#f1f5f9',
                    color: i === 0 ? 'white' : '#475569',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                  }}>
                    {i === 0 ? '💰' : i === 1 ? '🛡️' : '📄'}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827' }}>{benefit}</div>
                  <div style={{ fontSize: 18, color: '#0ea56c' }}>✓</div>
                </div>
              ))}
            </div>

            {/* ── LOAN OFFER (if exists) ── */}
            {loanOffer && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Pre-Approved Loan Offer</div>
                <div className="card" style={{
                  padding: 20, marginBottom: 16,
                  background: 'linear-gradient(135deg, #0d1442 0%, #1a2475 100%)', color: 'white',
                  position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(0,186,242,0.1)' }} />
                  <div style={{ position: 'absolute', bottom: -10, left: -10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(14,165,108,0.08)' }} />

                  <div style={{ fontSize: 12, color: '#7b8fcb', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4 }}>
                    PRE-APPROVED
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4, color: '#00BAF2' }}>
                    ₹{loanOffer.amount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
                    Based on {loanOffer.basis}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#7b8fcb' }}>Rate</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{loanOffer.rate}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#7b8fcb' }}>EMI</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>₹{loanOffer.emi.toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#7b8fcb' }}>Tenure</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{loanOffer.tenure} mo</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, padding: '10px', background: 'rgba(14,165,108,0.1)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#4ade80' }}>
                      Verified Income: ₹{loanOffer.verified_income.toLocaleString()} (90 days)
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── DATA VERIFICATION ── */}
            <div className="card" style={{
              padding: 16, marginBottom: 16,
              background: '#fefce8', border: '1px solid #fde68a'
            }}>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 20 }}>🔐</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>Data Verification Standard</div>
                  <div style={{ fontSize: 11, color: '#a16207', marginTop: 2 }}>
                    Aadhaar eKYC + UPI transaction verified. Income data from verified payroll transfers only.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', padding: '8px 16px', lineHeight: 1.5 }}>
              KaamPay provides income verification data only. Credit decisions remain with the lending institution.
              Report generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM ACTIONS ── */}
      <div style={{ padding: '0 16px 16px' }}>
        <button
          className="tappable"
          onClick={() => onNavigate('5')}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 15, fontWeight: 600,
            background: 'linear-gradient(135deg, #0d1442 0%, #1a2475 100%)', color: 'white',
            border: 'none', marginBottom: 10
          }}
        >
          ← Back to Worker Profile
        </button>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
