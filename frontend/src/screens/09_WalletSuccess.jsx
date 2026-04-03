import React, { useEffect, useState } from 'react';
import { useGlobalState } from '../context/GlobalState';

export default function WalletSuccessScreen({ onNavigate, topUpAmount }) {
  const { addWalletBalance, state } = useGlobalState();
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Add the balance to global state on mount
    if (topUpAmount > 0) {
      addWalletBalance(topUpAmount);
    }
    // Trigger confetti animation
    setTimeout(() => setAnimated(true), 300);
  }, []);

  const refId = 'PAYTM' + Math.floor(100000000 + Math.random() * 900000000);
  const timestamp = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  return (
    <div className="screen-body" style={{ padding: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f4f6fb' }}>

      {/* ── SUCCESS HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0ea56c 0%, #059669 100%)',
        padding: '48px 16px 32px', color: 'white', textAlign: 'center',
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: 'white', color: '#0ea56c',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
          margin: '0 auto 16px', fontWeight: 700,
          animation: 'checkmarkAnim 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
        }}>✓</div>

        <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>Money Added!</h1>
        <div style={{ fontSize: 14, opacity: 0.9 }}>Wallet top-up successful</div>

        <div style={{
          marginTop: 20, fontSize: 40, fontWeight: 700,
          animation: animated ? 'fadeSlideUp 0.5s ease both' : 'none',
          animationDelay: '0.3s'
        }}>
          ₹{topUpAmount?.toLocaleString() || 0}
        </div>

        <style>{`
          @keyframes checkmarkAnim {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes confettiFall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100px) rotate(360deg); opacity: 0; }
          }
        `}</style>
      </div>

      {/* ── TRANSACTION DETAILS ── */}
      <div style={{ padding: 16, flex: 1 }}>
        <div className="card" style={{ padding: 20, marginTop: -16, position: 'relative', zIndex: 10, animation: 'cardMount 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both', animationDelay: '0.2s' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Transaction Details</div>

          {[
            { label: 'Transaction ID', value: refId, mono: true },
            { label: 'Date & Time', value: timestamp },
            { label: 'Payment Method', value: 'UPI Transfer' },
            { label: 'Status', value: 'Completed', highlight: true },
            { label: 'Credited To', value: 'Paytm Business Wallet' },
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center" style={{
              padding: '10px 0',
              borderBottom: i < 4 ? '0.5px solid #f1f5f9' : 'none'
            }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{row.label}</div>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: row.highlight ? '#0ea56c' : '#111827',
                fontFamily: row.mono ? 'monospace' : 'inherit',
                fontSize: row.mono ? 11 : 13
              }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* New Balance Card */}
        <div className="card" style={{
          padding: 16, marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0',
          animation: 'cardMount 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both', animationDelay: '0.4s'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Updated Wallet Balance</div>
              <div style={{ fontSize: 11, color: '#4ade80', marginTop: 2 }}>Available for payroll</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0ea56c' }}>
              ₹{state.contractor.balance.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ACTIONS ── */}
      <div style={{ padding: 16 }}>
        <button
          className="tappable"
          onClick={() => onNavigate('6')}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 16, fontWeight: 600,
            background: 'linear-gradient(135deg, #0d1442 0%, #1a2475 100%)', color: 'white',
            marginBottom: 10, border: 'none'
          }}
        >
          Back to Dashboard
        </button>
        <button
          className="tappable"
          onClick={() => onNavigate('1')}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 16, fontWeight: 600,
            background: 'transparent', color: '#0d1442', border: '1.5px solid #0d1442'
          }}
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
