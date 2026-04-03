import React from 'react';
import { DEMO_DATA } from '../demo_data';
import { useGlobalState } from '../context/GlobalState';

export default function ContractorDashboardScreen({ onNavigate }) {
  const { state } = useGlobalState();
  const contractor = state.contractor;
  const { insights } = DEMO_DATA;

  return (
    <div className="screen-body" style={{ padding: 0, paddingBottom: 80, minHeight: '100vh', background: '#f4f6fb' }}>
      
      {/* ── HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg, #0d1442 0%, #1a2475 100%)', padding: '16px 16px 32px', color: 'white', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <h1 className="title" style={{ fontSize: 22, fontWeight: 600 }}>Business Insights</h1>
        <div style={{ fontSize: 13, color: '#7b8fcb', marginTop: 2 }}>{contractor.business}</div>
      </div>

      <div style={{ padding: 16, marginTop: -20, position: 'relative', zIndex: 10 }}>
        
        {/* ── AI INSIGHTS ── */}
        <h3 className="section-header mb-3">AI Recommendations</h3>
        <div className="flex flex-col gap-3 mb-6">
          {insights.map((insight, index) => {
            const isAlert = insight.type === 'alert';
            const isWarning = insight.type === 'warning';
            
            const color = isAlert ? '#ef4444' : isWarning ? '#f59e0b' : '#0ea56c';
            const bg = isAlert ? '#fff0f0' : isWarning ? '#fff8e6' : '#e6f9f0';

            return (
              <div key={index} className="card p-3 flex gap-3 items-center" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {insight.icon === 'star' ? '⭐' : insight.icon === 'trending_up' ? '📈' : '⚠️'}
                </div>
                <div className="flex-1">
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{insight.text_english}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{insight.text_hindi}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── MONTHLY SUMMARY ── */}
        <h3 className="section-header mb-3">Monthly Summary</h3>
        <div className="card p-4">
          <div className="flex justify-between items-center border-b pb-3 mb-3" style={{ borderBottom: '1px solid #e5e9f5' }}>
            <div style={{ color: '#475569', fontSize: 13 }}>Total Payroll Transferred</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>₹{contractor.monthly_total.toLocaleString()}</div>
          </div>
          <div className="flex justify-between items-center border-b pb-3 mb-3" style={{ borderBottom: '1px solid #e5e9f5' }}>
            <div style={{ color: '#475569', fontSize: 13 }}>Active Roster Size</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{contractor.total_workers} Workers</div>
          </div>
          <div className="flex justify-between items-center">
            <div style={{ color: '#475569', fontSize: 13 }}>Paytm Wallet Balance</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0ea56c' }}>₹{contractor.balance.toLocaleString()}</div>
          </div>
        </div>

        {/* ── ADD MONEY BUTTON ── */}
        <button
          className="tappable"
          onClick={() => onNavigate('8')}
          style={{
            width: '100%', marginTop: 16, padding: '16px 20px', borderRadius: 14,
            background: 'linear-gradient(135deg, #00BAF2 0%, #0096c4 100%)',
            color: 'white', fontSize: 16, fontWeight: 600, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 4px 14px rgba(0,186,242,0.35)',
            transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <span style={{ fontSize: 20 }}>💰</span>
          Add Money to Wallet
        </button>

      </div>
    </div>
  );
}
