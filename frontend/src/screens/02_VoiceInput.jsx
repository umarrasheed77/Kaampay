import React, { useState } from 'react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useGlobalState } from '../context/GlobalState';

export default function VoiceInputScreen({ onNavigate }) {
  const { state: globalState, addWorker, stagePayroll, searchWorker } = useGlobalState();
  const { isListening, transcript, error, startListening, stopListening, isSupported } = useVoiceRecognition();
  
  const [feedback, setFeedback] = useState(null);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null); // The VANI validation payload
  const [retryCount, setRetryCount] = useState(0);
  const [manualText, setManualText] = useState('');

  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    handleDictationResult({
      isFinal: true,
      action: 'API_DISPATCH',
      text: manualText
    });
    setManualText('');
  };

  const handleDictationResult = async (intent) => {
    // 1. Clean Search Hook (Fix False Negative Worker Loop)
    // Only verify workers when Voice STT is 100% complete (isFinal)
    if (intent.isFinal) {
      if (intent.action === 'ADD_WORKER') {
        const found = searchWorker(intent.name);
        if (found) {
           setFeedback(`Worker ${found.name} already exists!`);
           return;
        }
        addWorker(intent.name);
        setFeedback(`Worker ${intent.name} added!`);
        setTimeout(() => onNavigate('1'), 1200);
        return;
      } 
    } else {
        return; // Ignore interim parsed commands entirely to prevent premature checks
    }
    
    if (intent.action === 'ERROR') return;

    if (intent.action === 'API_DISPATCH' && intent.text) {
      setLoadingBackend(true);
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const resp = await fetch(`${API_URL}/api/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: intent.text })
        });
        const result = await resp.json();

        // Worker not found — show which names failed
        if (result.status === 'error' && result.error_message === "Worker not found.") {
          const unverified = result.verification?.unverified_names || [];
          const nameList = unverified.length > 0 ? unverified.join(', ') : 'Unknown';
          const retryMsg = `Worker not found: ${nameList}. Make sure these workers are registered first.`;
          setFeedback(retryMsg);
          if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(retryMsg);
            utter.lang = 'en-US';
            window.speechSynthesis.speak(utter);
          }
          setTimeout(() => setFeedback(null), 6000);
          return;
        }

        // Catch other errors or empty results to prevent empty confirmation screen
        if (result.status === 'error' || !result.payroll_entries || result.payroll_entries.length === 0) {
          setFeedback(result.error_message || "Couldn't understand the worker details. Please try again.");
          setTimeout(() => setFeedback(null), 4000);
          return;
        }

        if (result.status === 'success' && result.verification?.all_verified) {
          // ALL workers verified — proceed directly
          setRetryCount(0); // clear retry state on success 
          
          const verificationMsg = `Worker ${result.payroll_entries.map(e => e.worker_name).join(', ')} verified. Access accepted.`;
          setFeedback(verificationMsg);
          
          if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(verificationMsg);
            utter.lang = 'en-US';
            window.speechSynthesis.speak(utter);
          }

          const mappedEntries = result.payroll_entries.map(e => ({
            worker_id: e.worker_id || `W_NEW_${Math.floor(Math.random()*1000)}`,
            worker_name: e.worker_name,
            amount: e.gross_pay || (e.days_worked * e.rate_per_day),
            days_worked: e.days_worked,
            rate_per_day: e.rate_per_day,
            verified: true
          }));
          stagePayroll(mappedEntries);
          setTimeout(() => onNavigate('3'), 2000);
        } else {
          // Needs confirmation — show verification status per worker
          setConfirmationData(result);
        }
      } catch (err) {
        setFeedback("Failed to reach VANI Engine.");
        setTimeout(() => setFeedback(null), 3000);
      } finally {
        setLoadingBackend(false);
      }
    }
  };

  // --- Helpers for Confirmation Screen ---
  const handleAddBlankWorker = () => {
    setConfirmationData(prev => ({
      ...prev,
      payroll_entries: [
        ...prev.payroll_entries,
        { worker_name: "", days_worked: 1.0, rate_per_day: 700, gross_pay: 700, verified: false }
      ]
    }));
  };

  const handleRemoveEntry = (index) => {
    setConfirmationData(prev => ({
      ...prev,
      payroll_entries: prev.payroll_entries.filter((_, i) => i !== index)
    }));
  };

  const updateEntry = (index, field, value) => {
    setConfirmationData(prev => {
      const newEntries = [...prev.payroll_entries];
      newEntries[index] = { ...newEntries[index], [field]: value };
      
      if (field === 'days_worked' || field === 'rate_per_day') {
        newEntries[index].gross_pay = newEntries[index].days_worked * newEntries[index].rate_per_day;
      }
      return { ...prev, payroll_entries: newEntries };
    });
  };

  // Check if any remaining entries are unverified
  const hasUnverifiedWorkers = confirmationData?.payroll_entries?.some(e => 
    e.worker_name.trim().length > 0 && !e.verified
  ) || false;

  // Get unverified names for display
  const unverifiedNames = confirmationData?.verification?.unverified_names || [];

  const handleConfirmSubmit = () => {
    const validEntries = confirmationData.payroll_entries.filter(
      e => e.worker_name.trim().length > 0 && e.verified !== false
    );
    
    if (validEntries.length === 0) {
      setFeedback("No verified workers to process.");
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const mappedEntries = validEntries.map(e => ({
      worker_id: e.worker_id || globalState.workers.find(
        w => w.name.toLowerCase() === e.worker_name.toLowerCase()
      )?.id || `W_NEW_${Math.floor(Math.random()*1000)}`,
      worker_name: e.worker_name,
      amount: e.gross_pay,
      days_worked: e.days_worked,
      rate_per_day: e.rate_per_day,
      verified: e.verified
    }));
    stagePayroll(mappedEntries);
    onNavigate('3');
  };

  const readFeedbackAloud = () => {
    if (!confirmationData?.readback_hindi || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(confirmationData.readback_hindi);
    utter.lang = 'hi-IN';
    window.speechSynthesis.speak(utter);
  };

  // ── VIEW 1: NEEDS CONFIRMATION ──
  if (confirmationData) {
    return (
      <div className="screen-body" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        <div className="screen-header" style={{ paddingBottom: 16 }}>
          <h1 className="title">Did I get this right?</h1>
          <div style={{ color: '#9ca3af', fontSize: 14 }}>Maine yeh suna — sahi hai?</div>
        </div>

        {hasUnverifiedWorkers && (
          <div style={{ margin: '16px 16px 0', padding: 12, background: '#fee2e2', borderRadius: 8, color: '#b91c1c', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span> {confirmationData.verification_warning || "Some workers were not found in your database. Please remove or correct them."}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {confirmationData.payroll_entries.map((req, idx) => (
            <div key={idx} style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 12, border: '0.5px solid #e5e9f5', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Worker Name</span>
                    {req.verified === false && (
                      <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: 12, fontWeight: 600 }}>Not Found ❌</span>
                    )}
                    {req.verified && (
                      <span style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '2px 6px', borderRadius: 12, fontWeight: 600 }}>Verified ✓</span>
                    )}
                  </div>
                  <button onClick={() => handleRemoveEntry(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 600, padding: 4 }}>
                    Remove
                  </button>
                </div>
                <input 
                  type="text" 
                  value={req.worker_name} 
                  onChange={(e) => updateEntry(idx, 'worker_name', e.target.value)}
                  style={{ width: '100%', border: '1px solid #e5e9f5', borderRadius: 8, padding: '8px 12px', fontSize: 16, fontWeight: 500 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Days Worked</div>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e9f5', borderRadius: 8, overflow: 'hidden' }}>
                    <button className="tappable" onClick={() => updateEntry(idx, 'days_worked', Math.max(0.25, req.days_worked - 0.5))} style={{ width: 40, height: 38, background: '#f4f6fb', border: 'none', fontWeight: 'bold' }}>-</button>
                    <div style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>{req.days_worked}</div>
                    <button className="tappable" onClick={() => updateEntry(idx, 'days_worked', req.days_worked + 0.5)} style={{ width: 40, height: 38, background: '#f4f6fb', border: 'none', fontWeight: 'bold' }}>+</button>
                  </div>
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Daily Rate (₹)</div>
                  <input 
                    type="number" 
                    value={req.rate_per_day} 
                    onChange={(e) => updateEntry(idx, 'rate_per_day', Number(e.target.value))}
                    style={{ width: '100%', border: '1px solid #e5e9f5', borderRadius: 8, padding: '8px 12px', fontSize: 16, fontWeight: 600, textAlign: 'center' }}
                  />
                </div>
              </div>

              <div style={{ background: '#f4f6fb', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Net Pay</div>
                <div style={{ fontSize: 20, color: '#0ea56c', fontWeight: 700 }}>₹{req.gross_pay}</div>
              </div>
            </div>
          ))}

          <button 
            className="tappable" 
            onClick={handleAddBlankWorker}
            style={{ color: '#00BAF2', fontWeight: 600, fontSize: 15, background: 'transparent', border: 'none', padding: '12px 0', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e0f5fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</div>
            Add another worker
          </button>
        </div>

        <div style={{ padding: 16, background: 'white', borderTop: '1px solid #e5e9f5', display: 'flex', flexDirection: 'column', gap: 10 }}>
           <button 
            className="tappable"
            onClick={handleConfirmSubmit}
            disabled={hasUnverifiedWorkers}
            style={{ 
              width: '100%', 
              background: hasUnverifiedWorkers ? '#cbd5e1' : '#0d1442', 
              color: 'white', 
              border: 'none', 
              padding: '14px', 
              borderRadius: 12, 
              fontWeight: 600, 
              fontSize: 16,
              opacity: hasUnverifiedWorkers ? 0.7 : 1
            }}
           >
             {hasUnverifiedWorkers ? "Fix Errors to Confirm" : "Haan, sahi hai (Confirm)"}
           </button>
           <button 
            className="tappable"
            onClick={readFeedbackAloud}
            style={{ width: '100%', background: 'transparent', color: '#00BAF2', border: '1.5px solid #00BAF2', padding: '12px', borderRadius: 12, fontWeight: 600, fontSize: 15 }}
           >
             Dobara sunao (Hear again)
           </button>
        </div>
      </div>
    );
  }

  // ── VIEW 2: VOICE CAPTURE ──
  return (
    <div className="screen-body" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header" style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
        <div className="flex items-center gap-3">
          <button className="tappable" onClick={() => onNavigate('1')} style={{ color: 'white', fontSize: 20 }}>
            ←
          </button>
          <h1 className="title">New Payment</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: 24, marginTop: 40 }}>
        
        <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isListening && !feedback && !loadingBackend && (
            <>
              <div style={{
                position: 'absolute', inset: -20, borderRadius: '50%',
                border: '2px solid rgba(0,186,242,0.4)',
                animation: 'pulse 1.5s infinite var(--spring)'
              }} />
              <div style={{
                position: 'absolute', inset: -40, borderRadius: '50%',
                border: '2px solid rgba(0,186,242,0.2)',
                animation: 'pulse 1.5s infinite var(--spring)', animationDelay: '200ms'
              }} />
            </>
          )}

          <style>{`
            @keyframes pulse {
              0% { transform: scale(0.8); opacity: 0.8; }
              100% { transform: scale(1.4); opacity: 0; }
            }
          `}</style>
          
          <button 
            className="tappable"
            onClick={() => isListening ? stopListening() : startListening(handleDictationResult)}
            style={{
              width: 100, height: 100, borderRadius: '50%', border: 'none',
              background: loadingBackend ? '#9ca3af' : 'linear-gradient(135deg, #00BAF2 0%, #0096c4 100%)',
              boxShadow: '0 8px 24px rgba(0,186,242,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 36, zIndex: 10, transition: 'all 0.3s ease'
            }}
          >
            {loadingBackend ? '⏳' : '🎙'}
          </button>
        </div>

        <div className="mt-8 text-center" style={{ minHeight: 60 }}>
          {!isSupported && <div style={{color:'red'}}>Browser does not support Native Speech Recognition.</div>}
          
          {error && <div style={{color:'red'}}>{error}</div>}

          {feedback ? (
            <div style={{ fontSize: 18, fontWeight: 600, color: '#ef4444', animation: 'fadeIn 0.3s ease' }}>
              {feedback}
            </div>
          ) : loadingBackend ? (
            <div style={{ fontSize: 20, fontWeight: 500, color: '#111827', animation: 'pulse 1s infinite' }}>
              Extracting multiple workers...
            </div>
          ) : isListening ? (
            <div style={{ fontSize: 24, fontWeight: 500, color: '#111827' }}>
              {transcript}
              <span style={{ animation: 'livepulse 1s infinite' }}>|</span>
            </div>
          ) : (
             !error && isSupported && (
               <div style={{ fontSize: 16, fontWeight: 500, color: '#111827' }}>Tap mic and speak...</div>
             )
          )}
        </div>

        {/* --- MANUAL TEXT INPUT SECTION --- */}
        {!isListening && !loadingBackend && (
          <div style={{ width: '100%', maxWidth: '400px', marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
              <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
              <span style={{ padding: '0 12px', fontSize: '12px', color: '#9ca3af', fontWeight: '600', letterSpacing: '0.05em' }}>OR TYPE INSTEAD</span>
              <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
            </div>
            
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: '8px', textAlign: 'center' }}>
              e.g. Ramesh, Suresh, Mohan ko kal ka poora din, 700 rate lagao
            </div>
            
            <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Type worker details here..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                style={{ 
                  flex: 1, 
                  border: '1px solid #d1d5db', 
                  borderRadius: '12px', 
                  padding: '12px 16px', 
                  fontSize: '15px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              />
              <button 
                className="tappable"
                onClick={handleManualSubmit}
                disabled={!manualText.trim()}
                style={{ 
                  background: manualText.trim() ? '#00BAF2' : '#9ca3af', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '12px', 
                  padding: '0 20px', 
                  fontWeight: '600',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
