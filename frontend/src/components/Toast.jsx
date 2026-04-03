import React, { useState, useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const dotColor = type === 'success' ? '#0ea56c' :
                   type === 'error' ? '#ef4444' : '#00BAF2';

  return (
    <div style={{
      position: 'fixed',
      top: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#0d1442',
      color: 'white',
      fontSize: '12px',
      padding: '10px 16px',
      borderRadius: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      animation: 'toastSlide 300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
    }}>
      <style>{`
        @keyframes toastSlide {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor }} />
      {message}
    </div>
  );
}
