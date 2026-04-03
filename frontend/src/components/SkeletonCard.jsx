import React from 'react';

export default function SkeletonCard({ height = 80 }) {
  return (
    <div className="card skeleton-shimmer" style={{ height, marginBottom: 12, border: 'none' }}>
      <style>{`
        .skeleton-shimmer {
          background: linear-gradient(90deg, #f4f6fb 25%, #e5e9f5 50%, #f4f6fb 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite linear;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
