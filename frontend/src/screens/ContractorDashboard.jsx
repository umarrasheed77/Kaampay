import React from 'react';
import { CONSTANTS, DEMO_DATA } from '../demo_data';

export default function ContractorDashboard({ demoMode, onNewPayroll, onViewWorker }) {
  const { dashboard_summary, dashboard_workers, dashboard_insights } = DEMO_DATA;
  const contractor = CONSTANTS.demo_contractor;

  return (
    <div className="screen" style={{ padding: 0 }}>
      {/* ── Header ── */}
      <div className="header" style={{ borderRadius: '0 0 16px 16px' }}>
        <div className="header-logo">K</div>
        <div className="header-text">
          <h1>KaamPay</h1>
          <p>नमस्ते, {contractor.name} • {contractor.business}</p>
        </div>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* ── Dashboard Grid ── */}
        <div className="dashboard-grid">
          <div className="dashboard-card accent">
            <span className="dashboard-card-icon">💸</span>
            <div className="dashboard-card-value">₹{dashboard_summary.today_total}</div>
            <div className="dashboard-card-label">Today's Payouts</div>
          </div>
          <div className="dashboard-card">
            <span className="dashboard-card-icon">👥</span>
            <div className="dashboard-card-value">{dashboard_summary.today_workers}</div>
            <div className="dashboard-card-label">Workers Paid</div>
          </div>
          <div className="dashboard-card">
            <span className="dashboard-card-icon">📅</span>
            <div className="dashboard-card-value">₹{dashboard_summary.month_total.toLocaleString()}</div>
            <div className="dashboard-card-label">This Month</div>
          </div>
          <div className="dashboard-card">
            <span className="dashboard-card-icon">⚠️</span>
            <div className="dashboard-card-value">{dashboard_summary.pending_count}</div>
            <div className="dashboard-card-label">Pending Dues</div>
          </div>
        </div>

        {/* ── 30-Day Trend Chart ── */}
        <div className="card">
          <h3 className="text-sm font-bold text-gray-800 mb-4">30-Day Payout Trend</h3>
          <div className="mini-bar-chart">
            {DEMO_DATA.dashboard_daily_totals.slice(-14).map((day, i, arr) => {
              const maxTotal = Math.max(...arr.map(d => d.total));
              const heightPercent = day.total === 0 ? 0 : Math.max(5, (day.total / maxTotal) * 100);
              const isToday = i === arr.length - 1;
              return (
                <div key={day.date} className="bar-col">
                  <div className="bar-fill-wrap">
                    <div 
                      className={`bar-fill ${day.total === 0 ? 'zero' : ''} ${isToday ? 'today' : ''}`}
                      style={{ height: `${heightPercent}%`, animationDelay: `${i * 0.05}s` }}
                    />
                  </div>
                  <div className="bar-label">{isToday ? 'Today' : new Date(day.date).getDate()}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── AI Insight ── */}
        <div className={`insight-card ${dashboard_insights[0].type}`}>
          <div className="insight-icon">✨</div>
          <div className="bilingual">
            <span className="en text-sm font-semibold">{dashboard_insights[0].text_english}</span>
            <span className="hi text-xs">{dashboard_insights[0].text_hindi}</span>
          </div>
        </div>

        {/* ── Recent Worker Roster ── */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-bold text-gray-900">Recent Workers</h3>
            <span className="text-xs text-blue font-semibold cursor-pointer" onClick={() => onViewWorker(dashboard_workers[0])}>View All</span>
          </div>
          
          <div className="flex flex-col gap-2">
            {dashboard_workers.map(worker => (
              <div 
                key={worker.worker_id} 
                className="roster-card" 
                onClick={() => onViewWorker({ ...worker, id: worker.worker_id })}
              >
                <div className="worker-avatar" style={{ background: 'var(--blue-50)', width: 36, height: 36, fontSize: '0.9rem' }}>
                  {worker.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{worker.name}</div>
                  <div className="text-xs text-gray">KaamScore: {worker.kaam_score}</div>
                </div>
                <div className={`roster-status status-normal`}>Paid Today</div>
              </div>
            ))}
          </div>
          
          <button 
            className="btn btn-outline btn-full mt-3"
            onClick={() => onViewWorker(dashboard_workers[0])}
          >
            👤 View All Worker Profiles
          </button>
        </div>

      </div>

      {/* ── Sticky Action Button ── */}
      <div style={{ padding: '20px', paddingTop: 0 }}>
        <button 
          className="btn btn-primary btn-full btn-lg" 
          onClick={onNewPayroll}
          style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          <div className="flex items-center gap-2 text-base">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            Start New Payroll
          </div>
          <span className="text-xs font-normal opacity-80" style={{ fontFamily: 'var(--font-hi)' }}>नया वॉयस पेरोल शुरू करें</span>
        </button>
      </div>
    </div>
  );
}
