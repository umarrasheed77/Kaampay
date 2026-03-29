import React, { useState, useEffect, useRef } from 'react';
import { apiTranscribe } from '../api';
import { CONSTANTS } from '../demo_data';

/**
 * Screen 1: Voice Input
 * Contractor speaks or plays demo audio.
 * Features: pulsing mic, waveform visualization, typewriter transcript
 */
export default function VoiceInput({ onTranscribed }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const typingRef = useRef(null);

  // Typewriter effect
  useEffect(() => {
    if (!transcript) return;
    setIsTyping(true);
    setDisplayedText('');
    let i = 0;
    const text = transcript;
    typingRef.current = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(typingRef.current);
        setIsTyping(false);
        // Auto-proceed after typing finishes
        setTimeout(() => handleSubmit(text), 800);
      }
    }, 40);
    return () => clearInterval(typingRef.current);
  }, [transcript]);

  const handlePlayDemo = () => {
    setTranscript(CONSTANTS.demo_audio_transcript);
  };

  const handleMicClick = () => {
    if (isRecording) {
      setIsRecording(false);
      // Use Web Speech API result or demo transcript
      if (!transcript) {
        setTranscript(CONSTANTS.demo_audio_transcript);
      }
      return;
    }

    // Try Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const result = event.results[0][0].transcript;
        setIsRecording(false);
        setTranscript(result);
      };

      recognition.onerror = () => {
        setIsRecording(false);
        setTranscript(CONSTANTS.demo_audio_transcript);
      };

      recognition.onend = () => {
        if (isRecording) setIsRecording(false);
      };

      setIsRecording(true);
      recognition.start();
    } else {
      // Fallback — use demo transcript
      setTranscript(CONSTANTS.demo_audio_transcript);
    }
  };

  const handleSubmit = async (text) => {
    setIsProcessing(true);
    const result = await apiTranscribe(text);
    onTranscribed(result);
  };

  return (
    <div className="screen" style={{ justifyContent: 'space-between' }}>
      {/* Header */}
      <div>
        <div className="header" style={{ margin: '-20px -20px 0', borderRadius: 0 }}>
          <div className="header-logo">M</div>
          <div className="header-text">
            <h1>MazdoorPay</h1>
            <p>डिजिटल मज़दूरी | Powered by Paytm UPI</p>
          </div>
        </div>

        {/* Contractor Info */}
        <div style={{ marginTop: '24px', padding: '0 4px' }}>
          <p className="text-sm text-gray" style={{ fontFamily: 'var(--font-hi)' }}>
            नमस्ते, {CONSTANTS.demo_contractor.name}
          </p>
          <p className="text-xs text-gray">
            {CONSTANTS.demo_contractor.business} • {CONSTANTS.demo_contractor.location}
          </p>
        </div>
      </div>

      {/* Center — Mic Area */}
      <div className="flex flex-col items-center gap-6" style={{ flex: 1, justifyContent: 'center' }}>
        {!transcript ? (
          <>
            {/* Instruction text */}
            <div className="bilingual text-center">
              <p className="en text-lg">Speak — tell us your workers' wages</p>
              <p className="hi" style={{ fontSize: '1.1rem', color: 'var(--gray-700)' }}>
                बोलिए — आपके मज़दूरों की मज़दूरी बताएं
              </p>
            </div>

            {/* Mic Button */}
            <div className="relative">
              <button
                className={`mic-button ${isRecording ? 'recording' : ''}`}
                onClick={handleMicClick}
                id="mic-button"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </button>
              {!isRecording && (
                <>
                  <div className="mic-ripple" />
                  <div className="mic-ripple" />
                  <div className="mic-ripple" />
                </>
              )}
            </div>

            {/* Waveform when recording */}
            {isRecording && (
              <div className="waveform">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="waveform-bar"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  />
                ))}
              </div>
            )}

            <p className="text-xs text-gray text-center" style={{ marginTop: '4px' }}>
              Tap to record • टैप करें रिकॉर्ड करने के लिए
            </p>
          </>
        ) : (
          /* Transcript Display */
          <div style={{ width: '100%' }}>
            <div className="bilingual mb-3">
              <p className="en text-sm">Transcript</p>
              <p className="hi">पहचाना गया टेक्स्ट</p>
            </div>
            <div className="typewriter">
              <span style={{ fontFamily: 'var(--font-hi)' }}>{displayedText}</span>
              {isTyping && <span className="typewriter-cursor" />}
            </div>
            {isProcessing && (
              <div className="flex items-center gap-2 mt-4" style={{ justifyContent: 'center' }}>
                <div style={{
                  width: 20, height: 20, border: '2px solid var(--green-400)',
                  borderTopColor: 'transparent', borderRadius: '50%',
                  animation: 'spinStep 0.6s linear infinite'
                }} />
                <span className="text-sm text-green">Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom — Play Demo Button */}
      <div style={{ paddingBottom: '20px' }}>
        {!transcript && (
          <button
            className="btn btn-outline btn-full btn-lg"
            onClick={handlePlayDemo}
            id="play-demo-button"
          >
            <span>▶</span>
            <span>Play Demo</span>
            <span style={{ fontFamily: 'var(--font-hi)', fontSize: '0.85em', opacity: 0.7 }}>
              डेमो चलाएँ
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
