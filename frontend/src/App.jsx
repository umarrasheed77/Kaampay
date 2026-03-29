import React, { useState } from 'react';
import VoiceInput from './screens/VoiceInput';
import Processing from './screens/Processing';
import PayrollReview from './screens/PayrollReview';
import PaymentSuccess from './screens/PaymentSuccess';
import WorkerProfile from './screens/WorkerProfile';

/**
 * MazdoorPay — Main App
 * Routes between 5 demo screens in sequence.
 * State flows: VANI output → HISAAB output → PAISA output → display
 */
export default function App() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [vaniOutput, setVaniOutput] = useState(null);
  const [hisaabOutput, setHisaabOutput] = useState(null);
  const [paisaOutput, setPaisaOutput] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);

  const screens = [
    // Screen 0: Voice Input
    <VoiceInput
      key="voice"
      onTranscribed={(output) => {
        setVaniOutput(output);
        setCurrentScreen(1);
      }}
    />,
    // Screen 1: Processing
    <Processing
      key="processing"
      vaniOutput={vaniOutput}
      onProcessed={(output) => {
        setHisaabOutput(output);
        setCurrentScreen(2);
      }}
    />,
    // Screen 2: Payroll Review
    <PayrollReview
      key="review"
      hisaabOutput={hisaabOutput}
      onConfirm={(output) => {
        setPaisaOutput(output);
        setCurrentScreen(3);
      }}
    />,
    // Screen 3: Payment Success
    <PaymentSuccess
      key="payment"
      paisaOutput={paisaOutput}
      hisaabOutput={hisaabOutput}
      onViewProfile={(worker) => {
        setSelectedWorker(worker);
        setCurrentScreen(4);
      }}
    />,
    // Screen 4: Worker Profile
    <WorkerProfile
      key="profile"
      worker={selectedWorker}
      paisaOutput={paisaOutput}
      onBack={() => setCurrentScreen(3)}
      onHome={() => {
        setCurrentScreen(0);
        setVaniOutput(null);
        setHisaabOutput(null);
        setPaisaOutput(null);
        setSelectedWorker(null);
      }}
    />
  ];

  return (
    <div className="app-container">
      {screens[currentScreen]}
    </div>
  );
}
