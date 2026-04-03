import React from 'react';
import { useGlobalState } from '../context/GlobalState';

export default function PaymentSuccessScreen({ onNavigate }) {
  const { state } = useGlobalState();
  const batch = state.recent_batch || [];
  const totalAmount = batch.reduce((sum, item) => sum + (item.amount || item.net_pay || item.gross_pay || 0), 0);

  return (
    <div className="screen-body" style={{ padding: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* ── HEADER ── */}
      <div style={{ background: '#0ea56c', padding: '40px 16px 20px', color: 'white', textAlign: 'center', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'white', color: '#0ea56c',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          margin: '0 auto 16px', animation: 'checkmarkAnim 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both'
        }}>✓</div>
        <h1 className="title" style={{ fontSize: 24, fontWeight: 600 }}>Payment Complete</h1>
        <div style={{ fontSize: 16, opacity: 0.9, marginTop: 4 }}>₹{totalAmount} paid to {batch.length} workers</div>
        
        <style>{`
          @keyframes checkmarkAnim {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>

      <div style={{ padding: 16, flex: 1 }}>
        <h3 className="section-header mb-4">Transaction Details</h3>
        
        <div className="flex flex-col gap-3">
          {batch.map((res, index) => {
            const finalAmount = res.amount || res.net_pay || res.gross_pay || 0;
            const fullWorkerLookup = state.workers.find(w => w.id === res.worker_id);
            const aadharMask = fullWorkerLookup ? `XXXX-XXXX-${fullWorkerLookup.aadhaar_last4}` : "XXXX-XXXX-XXXX";
            const pseudoRef = "UPI" + Math.floor(100000000 + Math.random() * 900000000);

            return (
              <div key={res.worker_id || index} className="card p-4" style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e6f9f0', color: '#0ea56c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      ✓
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{res.worker_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>Ref: {pseudoRef}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: '#111827' }}>₹{finalAmount}</div>
                </div>
                
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #e5e9f5', fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                  <span><span style={{ color: '#00BAF2' }}>📱</span> SMS Payslip & Retail</span>
                  <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{aadharMask}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <button 
          className="btn-primary"
          onClick={() => onNavigate('1')}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
