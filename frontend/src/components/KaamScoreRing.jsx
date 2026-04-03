import React from 'react';

export default function KaamScoreRing({ score, animate = true }) {
  const maxScore = 900;
  const percentage = Math.min((score / maxScore) * 100, 100);
  
  // Circumference = 2 * PI * r
  const r = 50;
  const circ = 2 * Math.PI * r;
  const strokeDashoffset = circ - (percentage / 100) * circ;

  const getColor = (s) => {
    if (s < 500) return '#475569';
    if (s < 600) return '#f59e0b';
    if (s < 750) return '#0ea56c';
    return '#00BAF2';
  };
  const color = getColor(score);

  return (
    <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="70" cy="70" r="50" fill="transparent" stroke="#e5e9f5" strokeWidth="12" />
        {/* Fill */}
        <circle 
          cx="70" cy="70" r="50" fill="transparent" stroke={color} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={circ}
          style={{ 
            strokeDashoffset: animate ? circ : strokeDashoffset,
            animation: animate ? 'fillRing 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none'
          }}
        />
        <style>{`
          @keyframes fillRing {
            from { stroke-dashoffset: ${circ}; }
            to { stroke-dashoffset: ${strokeDashoffset}; }
          }
        `}</style>
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>KaamScore</div>
      </div>
    </div>
  );
}
