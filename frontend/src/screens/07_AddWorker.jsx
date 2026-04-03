import React, { useState } from 'react';
import Toast from '../components/Toast';
import { useGlobalState } from '../context/GlobalState';

export default function AddWorkerScreen({ onNavigate }) {
  const { addWorker } = useGlobalState();
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState('');
  const [name, setName] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleAadhaarKYC = () => {
    if (!name) {
      setToast('Please enter a name first.');
      return;
    }
    const cleanAadhaar = aadhaar.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');
    let currentErrors = {};

    if (cleanAadhaar.length !== 12) {
      currentErrors.aadhaar = "Aadhar must be exactly 12 digits.";
    }
    if (cleanPhone.length !== 10) {
      currentErrors.phone = "Phone must be exactly 10 digits.";
    }

    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      setToast("Please fix the highlighted errors.");
      return;
    }

    setErrors({});
    setToast('Verifying Aadhaar eKYC via Paytm...');
    setTimeout(() => setStep(2), 1500);
  };

  const handleCreate = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanAadhaar = aadhaar.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrors({ phone: "Invalid Phone Number. Must be 10 digits." });
      setToast("Invalid Phone Number.");
      return;
    }
    setErrors({});
    setLoading(true);
    setToast('Registering worker on FastAPI Server...');

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/register-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          phone_number: cleanPhone,
          aadhaar_number: cleanAadhaar,
          job_category: "unskilled"
        })
      });

      const dbRecord = await resp.json();

      if (!resp.ok || dbRecord.success === false) {
        console.warn("Backend registration failed:", dbRecord);
        setToast(dbRecord.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      // Backend succeeded — add to local state too
      addWorker(name);
      setLoading(false);
      setToast('Worker Created! Initial KaamScore: 350');
      setTimeout(() => onNavigate('1'), 2000);

    } catch (e) {
      console.warn("Backend offline:", e);
      setLoading(false);
      setToast('❌ Server connection failed. Check that backend is running on port 8000.');
    }
  };

  return (
    <div className="screen-body" style={{ padding: 0, paddingBottom: 80, minHeight: '100vh', background: '#f4f6fb' }}>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* ── HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg, #0d1442 0%, #1a2475 100%)', padding: '16px 16px 32px', color: 'white', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <div className="flex justify-between items-center mb-6">
          <button className="tappable" onClick={() => onNavigate('1')} style={{ color: 'white', fontSize: 20 }}>
            ← Back
          </button>
        </div>
        <h1 className="title" style={{ fontSize: 22, fontWeight: 600 }}>Add New Worker</h1>
        <div style={{ fontSize: 13, color: '#00BAF2', marginTop: 2, fontWeight: 500 }}>Secure Aadhaar eKYC Onboarding</div>
      </div>

      <div style={{ padding: 16, marginTop: -20, position: 'relative', zIndex: 10 }}>

        {step === 1 && (
          <div className="card p-4 flex flex-col gap-4">
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Worker's legal name" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e9f5', background: '#f9fafb', fontSize: 14 }} />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: errors.aadhaar ? '#ef4444' : '#475569', display: 'block', marginBottom: 6 }}>
                Aadhaar Number
              </label>
              <input
                type="tel"
                value={aadhaar}
                onChange={e => setAadhaar(e.target.value)}
                placeholder="12-digit Aadhaar"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${errors.aadhaar ? '#ef4444' : '#e5e9f5'}`, background: '#f9fafb', fontSize: 14, letterSpacing: 2 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: errors.phone ? '#ef4444' : '#475569', display: 'block', marginBottom: 6 }}>
                Phone Number (for Payslips/Wallets)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${errors.phone ? '#ef4444' : '#e5e9f5'}`, background: '#f9fafb', fontSize: 14 }}
              />
            </div>

            <button className="btn-primary mt-4 tappable" onClick={handleAadhaarKYC}>
              Verify via Aadhaar eKYC
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="card p-4 flex flex-col gap-4" style={{ animation: 'cardMount 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
            <div className="flex justify-center mb-2">
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e6f9f0', color: '#0ea56c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                ✓
              </div>
            </div>

            <div className="text-center">
              <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Aadhaar Verified</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Paytm Payments Bank ID created successfully.</div>
            </div>

            <div style={{ background: '#f9fafb', padding: 12, borderRadius: 12, border: '1px solid #e5e9f5', marginTop: 8 }}>
              <div className="flex justify-between items-center mb-2">
                <span style={{ fontSize: 12, color: '#64748b' }}>Assigned Phone</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Feature Phone</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ fontSize: 12, color: '#64748b' }}>Delivery Method</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0ea56c' }}>SMS Payslip & Retail</span>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading}
              style={{
                background: loading ? '#9ca3af' : 'linear-gradient(135deg, #00BAF2 0%, #0096c4 100%)',
                color: 'white', padding: '14px', borderRadius: 14, fontWeight: 600, fontSize: 16, width: '100%', marginTop: 16
              }}
              className="tappable"
            >
              {loading ? 'Registering Server Sync...' : 'Finish Profile Setup'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
