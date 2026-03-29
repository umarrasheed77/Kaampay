import React, { useState, useEffect } from 'react';
import { apiProcessPayroll } from '../api';

/**
 * Screen 2: Processing
 * Shows AI pipeline working — 4 animated steps.
 * Tech judges see the raw JSON appearing.
 */
const STEPS = [
  { en: "Transcribing voice...", hi: "Voice samjhi ja rahi hai...", icon: "🎙️" },
  { en: "Extracting names & hours...", hi: "Naam aur ghante nikal rahe hain...", icon: "🔍" },
  { en: "Checking minimum wage...", hi: "Minimum wage check ho raha hai...", icon: "⚖️" },
  { en: "Payroll ready!", hi: "Payroll tayyar!", icon: "✅" }
];

export default function Processing({ vaniOutput, onProcessed }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showJson, setShowJson] = useState(false);
  const [hisaabResult, setHisaabResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const runPipeline = async () => {
      // Step 1: Transcribing (already done, just animate)
      await delay(800);
      if (cancelled) return;
      setCompletedSteps(prev => [...prev, 0]);
      setCurrentStep(1);

      // Step 2: Extracting
      await delay(1000);
      if (cancelled) return;
      setCompletedSteps(prev => [...prev, 1]);
      setCurrentStep(2);
      setShowJson(true);

      // Step 3: Minimum wage check — call HISAAB API
      const result = await apiProcessPayroll(vaniOutput);
      if (cancelled) return;
      setHisaabResult(result);
      await delay(800);
      if (cancelled) return;
      setCompletedSteps(prev => [...prev, 2]);
      setCurrentStep(3);

      // Step 4: Done
      await delay(600);
      if (cancelled) return;
      setCompletedSteps(prev => [...prev, 3]);

      // Navigate to next screen
      await delay(800);
      if (cancelled) return;
      onProcessed(result);
    };

    runPipeline();
    return () => { cancelled = true; };
  }, []);

  const getStepStatus = (index) => {
    if (completedSteps.includes(index)) return 'done';
    if (index === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div className="screen">
      {/* Header */}
      <div className="header" style={{ margin: '-32px -20px 0', borderRadius: 0 }}>
        <div className="header-logo">M</div>
        <div className="header-text">
          <h1>MazdoorPay</h1>
          <p>AI Payroll Processing</p>
        </div>
      </div>

      <div style={{ marginTop: '32px' }}>
        <div className="bilingual mb-6">
          <p className="en" style={{ fontSize: '1.25rem' }}>Processing your payroll</p>
          <p className="hi" style={{ fontSize: '1rem' }}>Aapki payroll tayyar ho rahi hai</p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-2">
          {STEPS.map((step, index) => {
            const status = getStepStatus(index);
            return (
              <div
                key={index}
                className="step-item"
                style={{
                  animationDelay: `${index * 0.2}s`,
                  opacity: index <= currentStep ? 1 : 0.3
                }}
              >
                <div className={`step-icon ${status}`}>
                  {status === 'done' ? '✓' : status === 'active' ? '⟳' : step.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{
                    color: status === 'done' ? 'var(--green-600)' :
                           status === 'active' ? 'var(--gray-900)' : 'var(--gray-400)'
                  }}>
                    {step.en}
                  </p>
                  <p className="text-xs" style={{
                    fontFamily: 'var(--font-hi)',
                    color: status === 'done' ? 'var(--green-500)' : 'var(--gray-400)'
                  }}>
                    {step.hi}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Extracted JSON Preview */}
        {showJson && vaniOutput && (
          <div style={{ marginTop: '24px' }}>
            <div className="bilingual mb-2">
              <p className="en text-xs" style={{ color: 'var(--gray-500)' }}>Extracted Data</p>
              <p className="hi text-xs">Nikala Gaya Data</p>
            </div>
            <div className="json-display">
              <pre>{JSON.stringify(vaniOutput.payroll_entries, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Confidence indicator */}
        {vaniOutput && (
          <div className="flex items-center gap-2 mt-4">
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: vaniOutput.confidence > 0.8 ? 'var(--green-400)' :
                          vaniOutput.confidence > 0.6 ? 'var(--amber-400)' : 'var(--red-500)'
            }} />
            <span className="text-xs text-gray">
              AI Confidence: {Math.round(vaniOutput.confidence * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
