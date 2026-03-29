import React, { useState } from 'react';
import { apiExecutePayments } from '../api';

/**
 * Screen 3: Payroll Review
 * Contractor confirms workers and amounts before payment.
 * Shows wage compliance warnings, delivery methods, MazdoorScore preview.
 */

const DELIVERY_LABELS = {
  whatsapp_payslip: { label: "WhatsApp", labelHi: "व्हाट्सएप", emoji: "📱", cls: "whatsapp" },
  sms_payslip: { label: "SMS", labelHi: "एसएमएस", emoji: "💬", cls: "sms" },
  qr_paper_receipt: { label: "QR Receipt", labelHi: "QR रसीद", emoji: "📄", cls: "qr" }
};

export default function PayrollReview({ hisaabOutput, onConfirm }) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!hisaabOutput) return null;

  const { entries, total_payout, worker_count, contractor, payroll_date } = hisaabOutput;

  const handlePayment = async () => {
    setIsProcessing(true);
    const result = await apiExecutePayments(hisaabOutput);
    onConfirm(result);
  };

  const hasWageWarning = entries.some(e => !e.wage_compliant);

  return (
    <div className="screen" style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <div className="header" style={{ margin: '-32px -20px 0', borderRadius: 0 }}>
        <div className="header-logo">M</div>
        <div className="header-text">
          <h1>MazdoorPay</h1>
          <p>Payroll Review | पेरोल समीक्षा</p>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        {/* Date & Contractor */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm font-semibold">{contractor?.business}</p>
            <p className="text-xs text-gray">{payroll_date}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray">Workers</p>
            <p className="text-lg font-bold text-green">{worker_count}</p>
          </div>
        </div>

        {/* Wage Warning */}
        {hasWageWarning && (
          <div className="wage-warning mb-4">
            <span>⚠️</span>
            <div>
              <p className="font-semibold" style={{ fontSize: '0.8125rem' }}>Below Minimum Wage</p>
              <p style={{ fontFamily: 'var(--font-hi)', fontSize: '0.75rem' }}>
                Kuch rates minimum wage se kam hain
              </p>
            </div>
          </div>
        )}

        {/* Worker Cards */}
        <div className="flex flex-col gap-3">
          {entries.map((entry, index) => {
            const delivery = DELIVERY_LABELS[entry.delivery_method] || DELIVERY_LABELS.qr_paper_receipt;
            return (
              <div 
                key={entry.worker_id} 
                className="worker-card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex gap-3">
                  {/* Avatar */}
                  <div className="worker-avatar">
                    {entry.worker_name.split(' ').map(n => n[0]).join('')}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-sm">{entry.worker_name}</p>
                        <p className="text-xs text-gray">
                          Aadhaar: •••• {entry.aadhaar_last4}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green">₹{entry.net_pay.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex gap-3">
                        <span className="text-xs text-gray">
                          {entry.days_worked} {entry.days_worked === 1 ? 'day' : 'days'} • ₹{entry.rate_per_day}/day
                        </span>
                      </div>
                      <div className={`delivery-badge ${delivery.cls}`}>
                        <span>{delivery.emoji}</span>
                        <span>{delivery.label}</span>
                      </div>
                    </div>

                    {/* MazdoorScore mini bar */}
                    <div className="mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray">
                          MazdoorScore • {entry.days_in_system} din
                        </span>
                      </div>
                      <div className="score-bar-track mt-1" style={{ height: '4px' }}>
                        <div className="score-bar-fill" style={{
                          width: `${Math.min((entry.days_in_system / 90) * 100, 100)}%`
                        }} />
                      </div>
                    </div>

                    {/* Wage Warning for this worker */}
                    {!entry.wage_compliant && entry.wage_warning && (
                      <p className="text-xs mt-2" style={{
                        color: '#92400e',
                        fontFamily: 'var(--font-hi)',
                        fontSize: '0.6875rem'
                      }}>
                        ⚠️ {entry.wage_warning}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed Bottom — Total + Pay Button */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '390px',
        background: 'var(--white)',
        borderTop: '1px solid var(--gray-200)',
        padding: '16px 20px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        zIndex: 10
      }}>
        <div className="flex justify-between items-center mb-3">
          <div className="bilingual">
            <p className="en text-sm">Total Payout</p>
            <p className="hi">कुल भुगतान</p>
          </div>
          <p style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--green-700)',
            letterSpacing: '-0.02em'
          }}>
            ₹{total_payout.toLocaleString()}
          </p>
        </div>

        <button
          className="btn btn-paytm btn-full btn-lg"
          onClick={handlePayment}
          disabled={isProcessing}
          id="pay-button"
          style={{ opacity: isProcessing ? 0.7 : 1 }}
        >
          {isProcessing ? (
            <>
              <div style={{
                width: 20, height: 20, border: '2px solid white',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spinStep 0.6s linear infinite'
              }} />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '1.1em' }}>💸</span>
              <span>Paytm se Bhejo</span>
              <span style={{ fontFamily: 'var(--font-hi)', fontSize: '0.85em', opacity: 0.8 }}>
                पेटीएम से भेजो
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
