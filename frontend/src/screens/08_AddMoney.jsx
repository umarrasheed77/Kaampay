import React, { useState } from 'react';
import { useGlobalState } from '../context/GlobalState';

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 25000, 50000];

export default function AddMoneyScreen({ onNavigate }) {
  const { state } = useGlobalState();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('upi');

  const handleAmountInput = (val) => {
    // Only allow digits
    const clean = val.replace(/\D/g, '');
    setAmount(clean);
  };

  const handleQuickSelect = (val) => {
    setAmount(String(val));
  };

  const handlePay = () => {
    const numAmount = parseInt(amount, 10);
    if (!numAmount || numAmount < 1) return;
    // Navigate to wallet success screen and pass the amount via query-style encoding
    onNavigate('9:' + numAmount);
  };

  const numericAmount = parseInt(amount, 10) || 0;

  return (
    <div className="screen-body" style={{ padding: 0, paddingBottom: 80, minHeight: '100vh', background: '#f4f6fb' }}>

      {/* ── HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg, #0d1442 0%, #1a2475 100%)', padding: '16px 16px 32px', color: 'white', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <div className="flex items-center gap-3">
          <button className="tappable" onClick={() => onNavigate('6')} style={{ color: 'white', fontSize: 20 }}>
            ←
          </button>
          <div>
            <h1 className="title" style={{ fontSize: 22, fontWeight: 600 }}>Add Money</h1>
            <div style={{ fontSize: 13, color: '#7b8fcb', marginTop: 2 }}>Paytm Wallet Top-Up</div>
          </div>
        </div>

        {/* Current Balance Pill */}
        <div style={{
          marginTop: 16, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Current Balance</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#00BAF2' }}>₹{state.contractor.balance.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ padding: 16, marginTop: -16, position: 'relative', zIndex: 10 }}>

        {/* ── AMOUNT INPUT ── */}
        <div className="card" style={{ padding: 24, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginBottom: 12, letterSpacing: '0.05em' }}>ENTER AMOUNT</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontSize: 36, fontWeight: 300, color: numericAmount > 0 ? '#111827' : '#d1d5db' }}>₹</span>
            <input
              type="tel"
              value={amount}
              onChange={(e) => handleAmountInput(e.target.value)}
              placeholder="0"
              autoFocus
              style={{
                border: 'none', outline: 'none', fontSize: 42, fontWeight: 700, width: '60%',
                textAlign: 'center', background: 'transparent', color: '#111827',
                caretColor: '#00BAF2'
              }}
            />
          </div>
          <div style={{ width: 60, height: 3, background: numericAmount > 0 ? '#00BAF2' : '#e5e9f5', borderRadius: 2, margin: '8px auto 0', transition: 'background 0.3s' }} />
        </div>

        {/* ── QUICK AMOUNTS ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 10 }}>Quick Select</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {QUICK_AMOUNTS.map((val) => (
              <button
                key={val}
                className="tappable"
                onClick={() => handleQuickSelect(val)}
                style={{
                  padding: '10px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
                  background: String(val) === amount ? '#0d1442' : '#f4f6fb',
                  color: String(val) === amount ? 'white' : '#0d1442',
                  border: String(val) === amount ? 'none' : '1px solid #e5e9f5',
                  transition: 'all 0.2s ease'
                }}
              >
                ₹{val.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* ── PAYMENT METHOD ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 10 }}>Payment Method</div>
          <div className="flex flex-col gap-2">
            {[
              { id: 'upi', label: 'UPI / Google Pay / PhonePe', icon: '📱', sublabel: 'Instant transfer' },
              { id: 'bank', label: 'Net Banking', icon: '🏦', sublabel: 'All major banks' },
              { id: 'card', label: 'Debit / Credit Card', icon: '💳', sublabel: 'Visa, Mastercard, RuPay' }
            ].map((method) => (
              <button
                key={method.id}
                className="tappable card"
                onClick={() => setSelectedMethod(method.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  border: selectedMethod === method.id ? '2px solid #00BAF2' : '1px solid #e5e9f5',
                  background: selectedMethod === method.id ? '#f0faff' : 'white',
                  textAlign: 'left', borderRadius: 12, transition: 'all 0.2s ease',
                  animation: 'none'
                }}
              >
                <div style={{ fontSize: 22, width: 36, textAlign: 'center' }}>{method.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{method.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{method.sublabel}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: selectedMethod === method.id ? 'none' : '2px solid #d1d5db',
                  background: selectedMethod === method.id ? '#00BAF2' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 700
                }}>
                  {selectedMethod === method.id && '✓'}
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── STICKY PAY BUTTON ── */}
      <div style={{
        position: 'fixed', bottom: 65, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 390, background: 'white', padding: '16px',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.05)', borderTop: '0.5px solid #e5e9f5', zIndex: 40
      }}>
        {numericAmount > 0 && (
          <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>New Balance after top-up</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0ea56c' }}>₹{(state.contractor.balance + numericAmount).toLocaleString()}</div>
          </div>
        )}
        <button
          className="tappable"
          onClick={handlePay}
          disabled={numericAmount < 1}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 16, fontWeight: 600,
            background: numericAmount > 0 ? 'linear-gradient(135deg, #00BAF2 0%, #0096c4 100%)' : '#e5e9f5',
            color: numericAmount > 0 ? 'white' : '#9ca3af',
            transition: 'all 0.3s ease',
            border: 'none'
          }}
        >
          {numericAmount > 0 ? `Pay ₹${numericAmount.toLocaleString()}` : 'Enter Amount'}
        </button>
      </div>
    </div>
  );
}
