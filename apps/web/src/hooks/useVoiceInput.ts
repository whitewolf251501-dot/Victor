'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type VoiceInputState =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'processing'
  | 'error';

export type VoiceInputError =
  | 'permission_denied'
  | 'not_supported'
  | 'network_error';

export interface UseVoiceInputOptions {
  onAutoSubmit?: (transcript: string) => void;
  silenceTimeoutMs?: number;
}

export function useVoiceInput({
  onAutoSubmit,
  silenceTimeoutMs = 1500,
}: UseVoiceInputOptions = {}) {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<VoiceInputError | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestTranscriptRef = useRef('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      setIsSupported(Boolean(SpeechRecognition));
    }
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Recognition already ended
      }
      recognitionRef.current = null;
    }
    setState('idle');
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    latestTranscriptRef.current = '';
    clearSilenceTimer();

    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('not_supported');
      setState('error');
      return;
    }

    setState('requesting_permission');

    // Explicitly prompt and verify microphone hardware permission
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release stream so SpeechRecognition can acquire exclusive control
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (permErr: any) {
      console.warn('[Victor Voice] Mic permission refused:', permErr);
      setError('permission_denied');
      setState('error');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setState('listening');
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }

        const trimmed = fullTranscript.trim();
        setTranscript(trimmed);
        latestTranscriptRef.current = trimmed;

        // Reset 1.5s silence timer
        clearSilenceTimer();
        if (trimmed.length > 0) {
          silenceTimerRef.current = setTimeout(() => {
            const final = latestTranscriptRef.current;
            if (final.length > 0 && onAutoSubmit) {
              setState('processing');
              stopListening();
              onAutoSubmit(final);
            }
          }, silenceTimeoutMs);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('[Victor Voice] Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('permission_denied');
        } else if (event.error === 'network') {
          setError('network_error');
        } else if (event.error !== 'no-speech') {
          setError('network_error');
        }
        setState('error');
        clearSilenceTimer();
      };

      recognition.onend = () => {
        clearSilenceTimer();
        setState((current) => (current === 'listening' ? 'idle' : current));
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (initErr) {
      console.error('[Victor Voice] Failed to initialize recognition:', initErr);
      setError('network_error');
      setState('error');
    }
  }, [onAutoSubmit, silenceTimeoutMs, stopListening]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  return {
    state,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
  };
}
