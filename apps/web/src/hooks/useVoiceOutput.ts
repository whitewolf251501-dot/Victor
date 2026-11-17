'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type VoiceOutputState = 'idle' | 'speaking' | 'error';

export interface UseVoiceOutputOptions {
  enabled?: boolean;
  rate?: number;
  pitch?: number;
  lang?: string;
}

export function useVoiceOutput({
  enabled = true,
  rate = 0.9,
  pitch = 0.85,
  lang = 'en-US',
}: UseVoiceOutputOptions = {}) {
  const [state, setState] = useState<VoiceOutputState>('idle');
  const [isSupported, setIsSupported] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      setIsSupported(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch (err) {
        console.warn('[Victor TTS] Error cancelling speech:', err);
      }
    }
    setState('idle');
  }, []);

  const cleanTextForSpeech = (text: string): string => {
    return text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link text](url) -> link text
      .replace(/[*_#`~>]/g, '') // strip markdown markers
      .replace(/•/g, ', ')
      .replace(/\n+/g, '. ')
      .trim();
  };

  const speak = useCallback(
    (rawText: string) => {
      if (!enabled || !isSupported || !synthRef.current) return;

      const clean = cleanTextForSpeech(rawText);
      if (!clean) return;

      try {
        // Cancel any active speech
        synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.lang = lang;

        // Try selecting a deep, natural voice if available
        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.toLowerCase().includes('natural') ||
              v.name.toLowerCase().includes('guy') ||
              v.name.toLowerCase().includes('david') ||
              v.name.toLowerCase().includes('male'))
        );

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          setState('speaking');
        };

        utterance.onend = () => {
          setState('idle');
        };

        utterance.onerror = (e) => {
          console.warn('[Victor TTS] Speech synthesis error:', e);
          setState('error');
          setTimeout(() => setState('idle'), 1500);
        };

        synthRef.current.speak(utterance);
      } catch (err) {
        console.error('[Victor TTS] Failed to execute speech synthesis:', err);
        setState('error');
      }
    },
    [enabled, isSupported, rate, pitch, lang]
  );

  useEffect(() => {
    return () => {
      if (synthRef.current) {
        try {
          synthRef.current.cancel();
        } catch {}
      }
    };
  }, []);

  return {
    state,
    isSupported,
    speak,
    stop,
  };
}
