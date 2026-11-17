'use client';

import React, { useState, useEffect, useRef } from 'react';
import { WolfAvatar, type WolfState } from '@/components/victor/wolf-avatar';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';

interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface ConversationItem {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export default function ChatPage() {
  const [wolfState, setWolfState] = useState<WolfState>('idle');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showConvDrawer, setShowConvDrawer] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load TTS preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vic_tts_enabled');
    if (saved !== null) {
      setTtsEnabled(saved === 'true');
    }
  }, []);

  // Web Voice Output (Text-to-Speech)
  const {
    state: ttsState,
    speak,
    stop: stopSpeaking,
  } = useVoiceOutput({
    enabled: ttsEnabled,
    rate: 0.9,
    pitch: 0.85,
    lang: 'en-US',
  });

  // Auto-scroll to latest message
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages]);

  // Toast notification dismiss timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Core message sender
  const executeSendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || isLoading || text.length > 2000) return;

    // Stop TTS if speaking
    stopSpeaking();

    // Optimistically add user message
    const tempUserMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputText('');
    setIsLoading(true);
    setWolfState('thinking');

    try {
      const res = await fetch('/api/victor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: activeConversationId ?? undefined,
          deviceType: 'web',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setWolfState('error');
        const errorMsg: MessageItem = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: data.error || 'Intelligence Core connection failure.',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setTimeout(() => setWolfState('idle'), 3000);
        return;
      }

      // Successful response
      if (data.conversationId && data.conversationId !== activeConversationId) {
        setActiveConversationId(data.conversationId);
        loadConversations();
      }

      const assistantMsg: MessageItem = {
        id: data.messageId || `vic-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setWolfState('success');

      // Vocalize response if TTS enabled
      if (ttsEnabled && data.response) {
        speak(data.response);
      }

      setTimeout(() => {
        setWolfState((current) => (current === 'success' ? 'idle' : current));
      }, 2500);
    } catch (err: unknown) {
      console.error('Chat error:', err);
      setWolfState('error');
      const errorMsg: MessageItem = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'System error: Unable to connect to Victor Noctis endpoint.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setTimeout(() => setWolfState('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Web Voice Input Hook (Web Speech API)
  const {
    state: voiceState,
    transcript: liveTranscript,
    error: voiceError,
    isSupported: isVoiceSupported,
    startListening,
    stopListening,
  } = useVoiceInput({
    onAutoSubmit: (transcript) => {
      executeSendMessage(transcript);
    },
    silenceTimeoutMs: 1500,
  });

  // Keep input text synchronized with live speech transcript
  useEffect(() => {
    if (voiceState === 'listening' && liveTranscript) {
      setInputText(liveTranscript);
    }
  }, [voiceState, liveTranscript]);

  // Sync Wolf avatar visual states with voice engine
  useEffect(() => {
    if (isLoading) {
      setWolfState('thinking');
    } else if (voiceState === 'listening') {
      setWolfState('listening');
    } else if (ttsState === 'speaking') {
      setWolfState('speaking');
    } else if (voiceState === 'error') {
      setWolfState('error');
      setTimeout(() => setWolfState('idle'), 3000);
    } else if (wolfState !== 'success') {
      setWolfState('idle');
    }
  }, [voiceState, ttsState, isLoading]);

  // Handle honest voice errors
  useEffect(() => {
    if (voiceError === 'permission_denied') {
      setToastMessage('Microphone access denied. Enable permissions in browser.');
    } else if (voiceError === 'not_supported') {
      setToastMessage('Voice not supported in this browser. Use Chrome.');
    } else if (voiceError === 'network_error') {
      setToastMessage('Voice network communication failed. Try again.');
    }
  }, [voiceError]);

  // Load conversations list
  const loadConversations = async () => {
    try {
      const res = await fetch('/api/victor/conversations');
      if (res.ok) {
        const data = await res.json();
        const convList = data.conversations ?? [];
        setConversations(convList);
        if (convList.length > 0 && !activeConversationId) {
          setActiveConversationId(convList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/victor/conversations/${activeConversationId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    fetchMessages();
  }, [activeConversationId]);

  // Start a new conversation
  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setShowConvDrawer(false);
    setWolfState('idle');
    stopSpeaking();
  };

  // Keyboard shortcut: Enter to submit, Shift+Enter for new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Stop voice output on typing
    stopSpeaking();

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeSendMessage(inputText);
    }
  };

  // Voice button toggle action
  const handleVoiceButtonClick = () => {
    if (!isVoiceSupported) {
      setToastMessage('Voice not supported in this browser. Use Chrome.');
      return;
    }

    if (voiceState === 'listening' || voiceState === 'requesting_permission') {
      stopListening();
    } else {
      stopSpeaking();
      startListening();
    }
  };

  return (
    <div className="flex h-full w-full bg-[#0a0a0f] overflow-hidden relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[#1a1a24] border border-sky-500/40 text-sky-300 font-mono text-xs shadow-xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          {toastMessage}
        </div>
      )}

      {/* Mic Permission Request Banner */}
      {voiceState === 'requesting_permission' && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-sky-950/80 border border-sky-500 text-sky-200 font-mono text-xs shadow-2xl flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          <span>Requesting microphone authorization...</span>
        </div>
      )}

      {/* Main Chat Flow */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Companion HUD Bar */}
        <div className="px-4 py-3 border-b border-[#2a2a3a] bg-[#111118]/70 backdrop-blur flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <WolfAvatar state={wolfState} size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold tracking-wider text-white">
                  VICTOR NOCTIS
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  {wolfState === 'thinking'
                    ? 'THINKING...'
                    : wolfState === 'listening'
                    ? 'LISTENING'
                    : wolfState === 'speaking'
                    ? 'VOCALIZING'
                    : wolfState === 'success'
                    ? 'RESOLVED'
                    : wolfState === 'error'
                    ? 'FAULT'
                    : 'STANDBY'}
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-500">
                L0-L4 Execution Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConvDrawer(!showConvDrawer)}
              className="px-2.5 py-1 text-xs font-mono rounded border border-[#2a2a3a] hover:border-slate-600 bg-[#1a1a24] text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
              <span className="hidden sm:inline">Threads ({conversations.length})</span>
            </button>
            <button
              onClick={handleNewConversation}
              className="px-2.5 py-1 text-xs font-mono rounded border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-colors flex items-center gap-1"
            >
              <span>+</span>
              <span className="hidden sm:inline">New Thread</span>
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 font-mono">
              <WolfAvatar state={wolfState} size="lg" className="mb-6 opacity-60" />
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-1">
                Victor Terminal Operational
              </h3>
              <p className="text-xs max-w-sm text-slate-400">
                Ready for high-level execution directives, persistent neural memory recall, or voice input.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-lg p-3.5 text-xs sm:text-sm font-mono whitespace-pre-wrap leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-sky-500/10 border border-sky-500/30 text-sky-100'
                        : 'bg-[#161620] border border-[#2a2a3a] text-slate-200'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[#2a2a3a] text-[10px] tracking-wider text-purple-400 font-bold uppercase">
                        <span>VICTOR NOCTIS</span>
                      </div>
                    )}
                    {msg.content}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 mt-1 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              );
            })
          )}

          {/* Thinking Indicator */}
          {isLoading && (
            <div className="flex flex-col items-start animate-fade-in">
              <div className="max-w-[80%] rounded-lg p-3.5 bg-[#111118] border-l-2 border-purple-500 border border-[#2a2a3a] font-mono text-xs text-purple-300 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                <span>Processing directive through neural core...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Dock (Always visible at bottom) */}
        <div className="p-3 sm:p-4 border-t border-[#2a2a3a] bg-[#111118] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeSendMessage(inputText);
            }}
            className="space-y-2"
          >
            <div className="relative rounded-lg border border-[#2a2a3a] bg-[#1a1a24] focus-within:border-sky-500/60 transition-colors">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => {
                  stopSpeaking();
                  setInputText(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={
                  voiceState === 'listening'
                    ? 'Listening... (Speak your directive, pauses submit automatically)'
                    : 'Direct Victor Noctis... (Shift+Enter for newline)'
                }
                maxLength={2000}
                rows={2}
                className="w-full bg-transparent p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none font-mono"
              />

              <div className="flex items-center justify-between px-3 py-2 border-t border-[#2a2a3a]/40 bg-[#161620]/60 rounded-b-lg">
                {/* Voice mic toggle & character counter */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleVoiceButtonClick}
                    title={
                      voiceState === 'listening'
                        ? 'Stop listening'
                        : 'Voice recognition (Web Speech API)'
                    }
                    className={`p-1.5 rounded transition-all flex items-center gap-1.5 text-xs font-mono ${
                      voiceState === 'listening'
                        ? 'bg-sky-500 text-slate-950 font-bold animate-pulse'
                        : 'text-slate-400 hover:text-sky-400 hover:bg-[#2a2a3a]/40'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                    {voiceState === 'listening' && <span>LISTENING...</span>}
                  </button>
                  <span className="text-[10px] font-mono text-slate-500">
                    {inputText.length}/2000
                  </span>
                </div>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="px-3.5 py-1.5 rounded font-mono text-xs font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-sm shadow-sky-500/20"
                >
                  <span>EXECUTE</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Drawer: Conversation Threads */}
      {showConvDrawer && (
        <div className="absolute inset-y-0 right-0 w-72 bg-[#111118] border-l border-[#2a2a3a] z-40 flex flex-col shadow-2xl animate-fade-in font-mono">
          <div className="p-3 border-b border-[#2a2a3a] flex items-center justify-between">
            <span className="text-xs font-bold text-white tracking-wider">
              CONVERSATION THREADS
            </span>
            <button
              onClick={() => setShowConvDrawer(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-slate-500 p-3">No recorded threads.</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    setShowConvDrawer(false);
                  }}
                  className={`w-full text-left p-2.5 rounded text-xs transition-colors truncate block ${
                    activeConversationId === conv.id
                      ? 'bg-[#1a1a24] text-sky-400 border border-sky-500/30'
                      : 'text-slate-400 hover:bg-[#1a1a24] hover:text-white'
                  }`}
                >
                  <div className="font-semibold truncate">
                    {conv.title || `Thread ${conv.id.substring(0, 8)}`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(conv.updated_at || conv.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
