import React from 'react';

export default function BottomSheet({ isOpen, onClose, children }) {
  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 100
        }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: `translateX(-50%) translateY(${isOpen ? '0%' : '100%'})`,
          width: '100%', maxWidth: '390px', backgroundColor: 'white',
          borderTopLeftRadius: '14px', borderTopRightRadius: '14px',
          padding: '24px 16px', zIndex: 101,
          transition: 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{
          position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
          width: '36px', height: '4px', backgroundColor: '#e5e9f5', borderRadius: '2px'
        }} />
        {children}
      </div>
    </>
  );
}
