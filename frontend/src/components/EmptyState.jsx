import React from 'react';

export default function EmptyState({ 
  message, 
  subMessage, 
  onRetry,
  showTextFallback,
  onTextFallback
}) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '40px 20px',
      background: '#fff',
      borderRadius: '14px',
      border: '0.5px solid #e5e9f5',
      margin: '16px'
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>
        🎙
      </div>
      <p style={{
        fontSize: 16,
        fontWeight: 500,
        color: '#111827',
        marginBottom: 6
      }}>
        {message}
      </p>
      <p style={{
        fontSize: 13,
        color: '#9ca3af',
        marginBottom: 24
      }}>
        {subMessage}
      </p>
      <button
        onClick={onRetry}
        style={{
          background: '#00BAF2',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '12px 28px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'block',
          width: '100%',
          marginBottom: 12
        }}
        className="tappable"
      >
        Try Again
      </button>
      {showTextFallback && (
        <button
          onClick={onTextFallback}
          style={{
            background: 'transparent',
            color: '#00BAF2',
            border: '0.5px solid #00BAF2',
            borderRadius: 10,
            padding: '12px 28px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%'
          }}
          className="tappable mt-2"
        >
          Type instead
        </button>
      )}
    </div>
  );
}
