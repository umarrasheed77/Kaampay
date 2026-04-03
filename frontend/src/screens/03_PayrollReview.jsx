import React, { useState, useEffect } from 'react';
import { useGlobalState } from '../context/GlobalState';
import { safeEntries } from '../utils/safeEntries';
import EmptyState from '../components/EmptyState';

export default function PayrollReviewScreen({ onNavigate }) {
  const { state, addPayroll, clearPendingPayroll, setRecentBatch } = useGlobalState();
  const [loading, setLoading] = useState(false);
  
  const entries = safeEntries(state.pending_payroll);
  const totalAmount = entries.reduce((sum, item) => sum + (item.amount || item.net_pay || item.gross_pay || 0), 0);

  useEffect(() => {
    if (entries.length > 0 && 'speechSynthesis' in window) {
      // Create voice readback
      const msgParts = entries.map(item => `${item.worker_name} ${item.amount || item.net_pay || item.gross_pay || 0} rupees for ${item.days_worked || 1} days`);
      const msg = `Paying ${msgParts.join(' and ')}. Please confirm on screen.`;
      
      const utter = new SpeechSynthesisUtterance(msg);
      utter.lang = 'en-IN';
      window.speechSynthesis.speak(utter);
    }
  }, []);

  const handlePay = async () => {
    setLoading(true);

    try {
      // Structure payload precisely for FastAPI backend Model (PaymentRequest)
        const payload = {
          status: "success",
          payroll_date: new Date().toISOString().split('T')[0],
          contractor: { id: "CONT_001", name: state.contractor?.name || "Demo Contractor" },
          entries: entries.map(item => ({
            worker_id: item.worker_id,
            worker_name: item.worker_name,
            net_pay: item.amount || item.net_pay || item.gross_pay || 0,
            days_worked: item.days_worked === 'Custom' ? 1 : item.days_worked,
            rate_per_day: item.rate_per_day || 700
          })),
          total_payout: totalAmount,
          worker_count: entries.length
        };

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/execute-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const dbRecord = await resp.json();
      
      if (!resp.ok) {
        console.warn("Backend Paisa engine rejected execution:", dbRecord);
      } else {
        console.log("Success! Backend PAISA Engine & KAGAZ PDF generated:", dbRecord);
      }
    } catch (e) {
       console.warn("Backend is offline. Processing strictly via local state context.", e);
    }

    // Always succeed locally for seamless resilient demo UX
    setTimeout(() => {
      entries.forEach(item => {
        addPayroll(item.worker_id, item.worker_name, item.amount || item.net_pay || item.gross_pay || 0);
      });
      setRecentBatch(entries); // Set global hook to pass to PaymentSuccess
      clearPendingPayroll();
      
      setLoading(false);
      onNavigate('4'); // Transition to Payment Success
    }, 800);
  };

  if (entries.length === 0) {
    return (
      <div className="screen-body flex flex-col items-center justify-center p-0 h-screen" style={{ background: '#f8fafc' }}>
        <EmptyState
          message="No workers extracted"
          subMessage="Please try recording again"
          onRetry={() => onNavigate('2')}
          showTextFallback={true}
          onTextFallback={() => onNavigate('2')}
        />
      </div>
    );
  }

  return (
    <div className="screen-body" style={{ padding: 0, paddingBottom: 100 }}>
      {/* ── HEADER ── */}
      <div className="screen-header" style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
        <div className="flex items-center gap-3">
          <button className="tappable" onClick={() => onNavigate('2')} style={{ color: 'white', fontSize: 20 }}>
            ←
          </button>
          <div>
            <h1 className="title">Review Payroll</h1>
            <div style={{ fontSize: 13, color: '#7b8fcb', marginTop: 2 }}>{entries.length} workers queued</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ background: '#e0f5fd', padding: 12, borderRadius: 12, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 18 }}>🎙️</div>
          <div>
            <div style={{ fontSize: 12, color: '#0077a8', fontWeight: 600 }}>Staged from Dictation Engine:</div>
            <div style={{ fontSize: 12, color: '#0d1442', marginTop: 4 }}>
              System generated payroll calculation ready for review.
            </div>
          </div>
        </div>

        {/* ── WORKER CARDS ── */}
        <div className="flex flex-col gap-3">
          {entries.map((entry, idx) => {
            // lookup worker metadata
            const worker = state.workers.find(w => w.id === entry.worker_id) || {};
            return (
              <div key={idx} className="card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3 items-center">
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f4f6fb', color: '#0d1442', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16 }}>
                      {entry.worker_name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{entry.worker_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Aadhaar ends in {worker.aadhaar_last4 || 'XXXX'}</div>
                    </div>
                  </div>
                  
                  {/* Right side amount */}
                  <div className="text-right">
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#0ea56c' }}>₹{entry.amount || entry.net_pay || entry.gross_pay || 0}</div>
                  </div>
                </div>

                {/* Calculations */}
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    {entry.days_worked} Day(s) × ₹{entry.rate_per_day}/day
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#0d1442', background: '#e5e9f5', padding: '2px 8px', borderRadius: 10 }}>
                    {worker.phone_type === 'smartphone' ? 'WhatsApp Payslip' :
                     worker.phone_type === 'feature_phone' ? 'SMS Payslip' : 'Card Load'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM STICKY PAY BAR ── */}
      <div style={{ 
        position: 'fixed', bottom: 65, left: '50%', transform: 'translateX(-50%)', 
        width: '100%', maxWidth: 390, background: 'white', padding: '16px 16px',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.05)', borderTop: '0.5px solid #e5e9f5',
        display: 'flex',flexDirection: 'column', gap: 12, zIndex: 40
      }}>
        <div className="flex justify-between items-center">
          <div style={{ fontWeight: 500, color: '#475569', fontSize: 14 }}>Total Payable</div>
          <div style={{ fontWeight: 700, color: '#111827', fontSize: 24 }}>₹{totalAmount}</div>
        </div>
        
        <button 
          className="tappable"
          onClick={handlePay}
          disabled={loading}
          style={{
            background: loading ? '#9ca3af' : 'linear-gradient(135deg, #00BAF2 0%, #0096c4 100%)',
            color: 'white', width: '100%', padding: '14px 0', borderRadius: 14,
            fontSize: 16, fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Processing...
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : 'Submit Payroll'}
        </button>
      </div>
    </div>
  );
}
