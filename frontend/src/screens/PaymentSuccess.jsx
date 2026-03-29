import React, { useState, useEffect, useRef } from 'react';

/**
 * Screen 4: Payment Success
 * THE EMOTIONAL PEAK OF THE DEMO.
 * Payments process one-by-one with animated counters.
 * Confetti on completion.
 */

function AnimatedCounter({ target, duration = 1000 }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <span>₹{value.toLocaleString()}</span>;
}

function ConfettiEffect() {
  const colors = ['#1a472a', '#f59e0b', '#00BAF2', '#34a853', '#ef4444', '#8b5cf6', '#ec4899'];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1}s`,
    size: Math.random() * 8 + 6,
    rotation: Math.random() * 360
  }));

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            animationDelay: p.delay,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: '2px',
            transform: `rotate(${p.rotation}deg)`
          }}
        />
      ))}
    </div>
  );
}

const DELIVERY_ICONS = {
  whatsapp_payslip: { icon: "📱", text: "WhatsApp payslip sent", textHi: "WhatsApp payslip भेजी गई" },
  sms_payslip: { icon: "💬", text: "SMS payslip sent", textHi: "SMS payslip भेजी गई" },
  qr_paper_receipt: { icon: "📄", text: "QR receipt ready for printing", textHi: "QR रसीद प्रिंट के लिए तैयार" }
};

export default function PaymentSuccess({ paisaOutput, hisaabOutput, onViewProfile }) {
  const [visiblePayments, setVisiblePayments] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const payments = paisaOutput?.payment_results || [];
  const entries = hisaabOutput?.entries || [];

  useEffect(() => {
    if (!payments.length) return;

    // Show payments one by one
    let i = 0;
    const showNext = () => {
      i++;
      setVisiblePayments(i);
      if (i < payments.length) {
        setTimeout(showNext, 1200);
      } else {
        // All done — show confetti + summary
        setTimeout(() => {
          setShowConfetti(true);
          setTimeout(() => setShowSummary(true), 500);
        }, 800);
      }
    };
    setTimeout(showNext, 600);
  }, [payments.length]);

  return (
    <div className="screen">
      {showConfetti && <ConfettiEffect />}

      {/* Header */}
      <div className="header" style={{ margin: '-32px -20px 0', borderRadius: 0 }}>
        <div className="header-logo">M</div>
        <div className="header-text">
          <h1>MazdoorPay</h1>
          <p>Payment Status | भुगतान स्थिति</p>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <div className="bilingual mb-4">
          <p className="en" style={{ fontSize: '1.125rem' }}>Sending payments via Paytm UPI</p>
          <p className="hi">Paytm UPI se bhej rahe hain</p>
        </div>

        {/* Payment Items */}
        <div className="flex flex-col gap-3">
          {payments.map((payment, index) => {
            const isVisible = index < visiblePayments;
            const delivery = DELIVERY_ICONS[payment.delivery_method] || DELIVERY_ICONS.sms_payslip;

            if (!isVisible) return null;

            return (
              <div
                key={payment.transaction_id}
                className="payment-item card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex gap-3 items-center">
                  {/* Avatar */}
                  <div className="worker-avatar">
                    {payment.worker_name.split(' ').map(n => n[0]).join('')}
                  </div>

                  {/* Name + Amount */}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{payment.worker_name}</p>
                    <p className="payment-amount">
                      <AnimatedCounter target={payment.amount} duration={800} />
                    </p>
                  </div>

                  {/* Check */}
                  <div className="payment-check">✓</div>
                </div>

                {/* Transaction Details */}
                <div style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--gray-100)'
                }}>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray" style={{ fontFamily: 'var(--font-mono)' }}>
                      UPI Ref: {payment.upi_reference}
                    </p>
                    <span className="text-xs" style={{
                      color: 'var(--green-600)',
                      fontWeight: 600
                    }}>
                      {payment.status}
                    </span>
                  </div>

                  {/* Delivery Status */}
                  <div className="flex items-center gap-1 mt-1">
                    <span>{delivery.icon}</span>
                    <span className="text-xs text-gray">{delivery.text} ✓</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {showSummary && (
          <div style={{
            marginTop: '24px',
            animation: 'screenFadeIn 0.5s var(--ease-out)'
          }}>
            {/* Big summary card */}
            <div className="card card-elevated text-center p-5" style={{
              background: 'linear-gradient(135deg, var(--green-50), var(--white))',
              border: '2px solid var(--green-100)'
            }}>
              <p style={{
                fontSize: '2rem',
                fontWeight: 800,
                color: 'var(--green-700)',
                letterSpacing: '-0.02em'
              }}>
                ₹{paisaOutput?.total_paid?.toLocaleString()}
              </p>
              <p className="text-sm" style={{ fontFamily: 'var(--font-hi)', color: 'var(--gray-600)', marginTop: '4px' }}>
                Aaj ₹{paisaOutput?.total_paid?.toLocaleString()} bheje gaye — {payments.length} mazdooron ko
              </p>
              <p className="text-xs text-gray mt-2">
                Today ₹{paisaOutput?.total_paid?.toLocaleString()} sent to {payments.length} workers
              </p>
            </div>

            {/* View Profile Buttons */}
            <div className="bilingual mt-6 mb-3">
              <p className="en text-sm">View Worker Profiles</p>
              <p className="hi">Mazdoor Profile dekhein</p>
            </div>

            <div className="flex flex-col gap-2">
              {entries.map((entry) => {
                const score = paisaOutput?.scores?.[entry.worker_id];
                return (
                  <button
                    key={entry.worker_id}
                    className="card flex items-center gap-3 w-full"
                    onClick={() => onViewProfile(entry)}
                    style={{
                      cursor: 'pointer',
                      textAlign: 'left',
                      border: '1px solid var(--gray-200)',
                      transition: 'all 0.2s ease'
                    }}
                    id={`view-profile-${entry.worker_id}`}
                  >
                    <div className="worker-avatar">
                      {entry.worker_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{entry.worker_name}</p>
                      <p className="text-xs text-gray">
                        MazdoorScore: {score?.score || 0} • {score?.band || 'building'}
                      </p>
                    </div>
                    <span style={{ color: 'var(--gray-400)', fontSize: '1.25rem' }}>→</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
