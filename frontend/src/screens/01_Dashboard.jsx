import React, { useState } from 'react';
import useCountUp from '../hooks/useCountUp';
import { useDemoMode } from '../hooks/useDemoMode.jsx';
import { useGlobalState } from '../context/GlobalState';
import BottomSheet from '../components/BottomSheet';
import Toast from '../components/Toast';

export default function DashboardScreen({ onNavigate }) {
  const { demoMode } = useDemoMode();
  const { state } = useGlobalState();
  const contractor = state.contractor;
  
  // States
  const [toast, setToast] = useState('');
  const [openSheet, setOpenSheet] = useState(null); // 'today', 'workers', 'month', 'pending'
  const pendingCount = state.pending_dues ? state.pending_dues.length : 0;
  const [retrying, setRetrying] = useState(false);
  const [retried, setRetried] = useState(false);

  // Counters (they will reactive-animate when underlying state changes)
  const todayTotal = useCountUp(contractor.today_total);
  const monthTotal = useCountUp(contractor.monthly_total);
  const workerCount = useCountUp(state.workers.length);

  const getScoreColor = (score) => {
    if (score < 500) return { bg: '#f1f5f9', fg: '#475569' };
    if (score < 600) return { bg: '#fff8e6', fg: '#92400e' };
    if (score < 750) return { bg: '#e6f9f0', fg: '#065f46' };
    return { bg: '#e0f5fd', fg: '#0077a8' };
  };

  const { stagePayroll, payPendingDue } = useGlobalState();
  const handlePayNow = (due) => {
    stagePayroll([{
      worker_id: due.worker_id,
      worker_name: due.worker_name,
      amount: due.amount,
      days_worked: 1,
      rate_per_day: due.amount
    }]);
    payPendingDue(due.worker_id); // Clear from pending list
    setOpenSheet(null);
    onNavigate('3'); // Go directly to Payment Summary
  };

  return (
    <div className="screen-body" style={{ padding: 0 }}>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* ── HEADER ── */}
      <div className="screen-header">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <span style={{ fontSize: 13, color: '#7b8fcb', fontWeight: 500 }}>Live Sync</span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 20 }}>🔔</span>
            <div style={{
              background: 'rgba(0,186,242,0.12)', border: '1px solid #00BAF2',
              color: '#00BAF2', fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 12
            }}>Demo Mode</div>
          </div>
        </div>
        <h1 className="title">KaamPay Dashboard</h1>
        <p className="subtitle mt-1" style={{ fontSize: 13, color: '#7b8fcb' }}>{contractor.business}</p>
      </div>

      <div style={{ padding: 14 }}>
        {/* ── METRIC CARDS GRID ── */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            {/* Card 1: Today */}
            <div className="card tappable flex-1" onClick={() => setOpenSheet('today')}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: '#e0f5fd', color: '#00BAF2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8
              }}>💸</div>
              <div className="value-lg" style={{ color: '#00BAF2' }}>₹{todayTotal.toLocaleString()}</div>
              <div className="label-sm">Today's Payouts</div>
            </div>

            {/* Card 2: Workers */}
            <div className="card tappable flex-1" onClick={() => setOpenSheet('workers')}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: '#e6f9f0', color: '#0ea56c',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8
              }}>👥</div>
              <div className="value-lg" style={{ color: '#0ea56c' }}>{workerCount}</div>
              <div className="label-sm">Total Workers</div>
            </div>
          </div>

          <div className="flex gap-3">
            {/* Card 3: Month */}
            <div className="card tappable flex-1" onClick={() => setOpenSheet('month')}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: '#fff8e6', color: '#f59e0b',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8
              }}>📅</div>
              <div className="value-lg" style={{ color: '#f59e0b' }}>₹{monthTotal.toLocaleString()}</div>
              <div className="label-sm">This Month Total</div>
            </div>

            {/* Card 4: Pending */}
            <div 
              className="card tappable flex-1" 
              onClick={() => pendingCount > 0 && setOpenSheet('pending')}
              style={{
                background: pendingCount > 0 ? '#fff5f5' : '#fff',
                borderColor: pendingCount > 0 ? '#fecaca' : '#e5e9f5',
                animation: pendingCount > 0 ? 'alertpulse 2s infinite' : 'initial'
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: '#fff0f0', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8
              }}>⚠️</div>
              <div className="value-lg" style={{ color: '#ef4444' }}>{pendingCount}</div>
              <div className="label-sm">Pending Dues</div>
            </div>
          </div>
        </div>

        {/* ── ADD WORKER BUTTON ── */}
        <button 
          className="w-full mt-4 flex items-center tappable"
          style={{ background: '#0d1442', borderRadius: 14, padding: '16px 20px', textAlign: 'left' }}
          onClick={() => onNavigate('7')}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00BAF2', fontSize: 24, marginRight: 16 }}>+</div>
          <div className="flex-1">
            <div style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>Add New Worker</div>
            <div style={{ color: '#7b8fcb', fontSize: 11, marginTop: 2 }}>Aadhaar eKYC • Paytm Payments Bank</div>
          </div>
        </button>

        {/* ── WORKER ROSTER ── */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="section-header">Worker Roster</h3>
            <span className="text-blue text-sm font-medium">See all</span>
          </div>

          <div className="flex flex-col gap-3 pb-24">
            {state.workers.map(worker => {
              const workerScore = worker.kaam_score || 350;
              const sc = getScoreColor(workerScore);
              
              // Has this worker been paid today?
              // Calculate logic here simply checks payroll_history
              const paidToday = state.payroll_history.some(p => p.worker_id === worker.id);

              return (
                <div 
                  key={worker.id} 
                  className="card flex items-center p-3 tappable relative overflow-hidden" 
                  style={{ margin: 0 }}
                  onClick={() => onNavigate('5:' + worker.id)}
                >
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#0d1442', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16, marginRight: 12 }}>
                    {worker.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{worker.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Daily Worker</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span style={{ background: sc.bg, color: sc.fg, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>Score: {workerScore}</span>
                    {paidToday && <span style={{ background: '#e6f9f0', color: '#065f46', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>Paid Today</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BOTTOM SHEETS ── */}
      
      {/* 1. Today's Payouts Drilldown */}
      <BottomSheet isOpen={openSheet === 'today'} onClose={() => setOpenSheet(null)}>
        <h3 className="section-header text-blue mb-4">Today's Transactions</h3>
        {state.payroll_history.length > 0 ? (
          <div className="flex flex-col gap-2">
            {state.payroll_history.map((tx, idx) => (
              <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-200 p-3" style={{ background: '#f9fafb', borderRadius: 12 }}>
                <div>
                   <div className="font-bold text-sm">{tx.worker_name}</div>
                   <div className="text-xs text-gray-500 mt-1">{new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
                <div style={{ fontWeight: 700, color: '#0ea56c' }}>₹{tx.amount}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>No records for today.</p>
        )}
      </BottomSheet>

      {/* 2. Total Workers Drilldown */}
      <BottomSheet isOpen={openSheet === 'workers'} onClose={() => setOpenSheet(null)}>
        <h3 className="section-header text-green mb-4">Current Active Roster</h3>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>You have {state.workers.length} verified workers registered.</p>
        <div className="flex flex-col gap-2">
            {state.workers.map((w, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 border-b border-gray-100">
                 <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e6f9f0', color: '#0ea56c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                 <div className="font-medium text-sm">{w.name}</div>
              </div>
            ))}
        </div>
      </BottomSheet>

      {/* 3. Failed Payments Drilldown */}
      <BottomSheet isOpen={openSheet === 'pending'} onClose={() => setOpenSheet(null)}>
        <h3 className="section-header text-danger mb-4">Pending Payments</h3>
        <div className="flex flex-col gap-3">
          {state.pending_dues && state.pending_dues.length > 0 ? state.pending_dues.map(due => (
            <div key={due.worker_id} className="p-3 bg-gray-50 rounded-lg flex flex-col gap-3 border border-gray-200" style={{ background: '#f9fafb', borderRadius: 12 }}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-gray-900">{due.worker_name}</div>
                  <div className="text-xs text-red-500 mt-1 flex items-center gap-1">⚠️ {due.reason}</div>
                </div>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: 16 }}>₹{due.amount}</div>
              </div>
              <button 
                className="tappable w-full"
                onClick={() => handlePayNow(due)}
                style={{
                  background: '#0d1442', color: 'white',
                  fontSize: 14, fontWeight: 600, padding: '10px 16px', borderRadius: 10
                }}
              >
                Pay Now
              </button>
            </div>
          )) : (
            <p className="text-center text-sm text-gray-500">No pending dues.</p>
          )}
        </div>
      </BottomSheet>
      
      {/* 4. Month Chart Sheet */}
      <BottomSheet isOpen={openSheet === 'month'} onClose={() => setOpenSheet(null)}>
        <div className="flex flex-col items-center">
          <div className="label-sm mb-1">April 2026</div>
          <div className="value-lg text-amber mb-6">₹{monthTotal.toLocaleString()}</div>
          <div className="flex items-end w-full gap-1 h-32 px-4">
            {[1,2,3,4,5,6,7].map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center h-full">
                <div className="w-full flex-1 flex flex-col justify-end">
                  <div 
                    style={{ 
                      width: '100%', 
                      height: `${20 + i*10}%`, 
                      background: i === 6 ? '#00BAF2' : '#dbeafe',
                      borderRadius: '4px 4px 0 0',
                      animation: 'barGrow 400ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
                      animationDelay: `${i * 45}ms`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>

    </div>
  );
}
