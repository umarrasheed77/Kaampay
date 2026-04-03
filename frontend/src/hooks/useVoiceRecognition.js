import { useState, useEffect, useCallback } from 'react';

export function useVoiceRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech Recognition is not supported in this browser.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true; // Stay active indefinitely for chained commands
    rec.interimResults = true; // Give us live preview
    rec.lang = 'en-IN'; // Mix of Hindi/English optimized for India

    setRecognition(rec);
  }, []);

  const parseCommand = (finalTranscript) => {
    const text = finalTranscript.toLowerCase().trim();
    
    // Pattern 1: Add [Name]
    // Fuzzy Matching: "add worker rahoul", "add work suresh", "add anil"
    const addMatch = text.match(/add\s+(?:worker\s+|work\s+|var\s+)?([a-z\s]+)/i);
    if (addMatch && addMatch[1]) {
      return { action: 'ADD_WORKER', name: addMatch[1].trim() };
    }

    // Pass everything else directly to the powerful VANI V2 Engine
    return { action: 'API_DISPATCH', text: finalTranscript };
  };

  const startListening = useCallback((onParsedCommand) => {
    if (!recognition) {
       setError("Recognition uninitialized.");
       return;
    }

    setIsListening(true);
    setTranscript('');
    setError(null);

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      // If we got the final result, parse and callback
      if (finalTranscript) {
        console.log(`[Voice Debugger] AI Heard exactly: "${finalTranscript}"`);
        const intent = parseCommand(finalTranscript);
        // Expose isFinal explicitly
        if (onParsedCommand) onParsedCommand({ ...intent, isFinal: true, raw: finalTranscript });
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setError(`Microphone error: ${event.error}`);
      if (onParsedCommand) onParsedCommand({ action: 'ERROR', message: event.error });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn("Could not start recognition:", err);
    }
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  }, [recognition]);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    isSupported: !!recognition
  };
}
