'use client';

import React, { useState, useEffect } from 'react';
import { signOutAction } from '@/app/(auth)/login/actions';
import { WolfAvatar } from '@/components/victor/wolf-avatar';

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  useEffect(() => {
    // Load local TTS preference
    const savedTts = localStorage.getItem('vic_tts_enabled');
    if (savedTts !== null) {
      setTtsEnabled(savedTts === 'true');
    }
  }, []);

  const handleToggleTts = () => {
    const nextState = !ttsEnabled;
    setTtsEnabled(nextState);
    localStorage.setItem('vic_tts_enabled', String(nextState));
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/victor/profile');
        if (res.ok) {
          const data = await res.json();
          setDisplayName(data.profile.displayName || '');
          setOwnerEmail(data.profile.email || '');
          setOwnerId(data.profile.id || '');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/victor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update profile');
      }

      setSaveStatus('Display identifier updated successfully.');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setSaveStatus(`Error: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-8 max-w-4xl w-full mx-auto font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[#2a2a3a]">
        <WolfAvatar state="idle" size="sm" />
        <div>
          <h1 className="text-xl font-bold tracking-wider text-white">
            SYSTEM SETTINGS & PROFILE
          </h1>
          <p className="text-xs text-slate-400">
            Owner credentials, theme enforcement, and execution parameters.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Section 1: Owner Profile */}
        <div className="p-6 rounded-lg bg-[#111118] border border-[#2a2a3a]">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-[#2a2a3a]">
            Owner Identification
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-28 bg-[#2a2a3a] rounded animate-pulse" />
              <div className="h-8 w-full bg-[#1a1a24] rounded animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                    Email Account
                  </label>
                  <input
                    type="text"
                    disabled
                    value={ownerEmail}
                    className="w-full px-3 py-2 rounded bg-[#161b22] border border-[#2a2a3a] text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                    Owner UUID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={ownerId}
                    className="w-full px-3 py-2 rounded bg-[#161b22] border border-[#2a2a3a] text-slate-500 font-mono text-[10px] cursor-not-allowed truncate"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  Display Identifier (Callsign)
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    placeholder="Commander / Shlok"
                    className="flex-1 px-3 py-2 rounded bg-[#161b22] border border-[#2a2a3a] text-white focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={isSaving || !displayName.trim()}
                    className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Updating...' : 'Update Callsign'}
                  </button>
                </div>
              </div>

              {saveStatus && (
                <div
                  className={`p-2.5 rounded text-xs ${
                    saveStatus.startsWith('Error')
                      ? 'bg-red-950/40 text-red-400 border border-red-500/30'
                      : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {saveStatus}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Section 2: Visual Interface Theme */}
        <div className="p-6 rounded-lg bg-[#111118] border border-[#2a2a3a] text-xs">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-[#2a2a3a]">
            Visual Theme
          </h2>
          <div className="flex items-center justify-between p-3 rounded bg-[#161b22] border border-[#2a2a3a]">
            <div>
              <span className="font-semibold text-white block mb-0.5">
                OLED Obsidian Dark (Locked)
              </span>
              <span className="text-slate-400 text-[11px]">
                Victor Noctis operates strictly in high-contrast tactical dark mode. No toggle is permitted.
              </span>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#1f293d] text-sky-400 font-bold text-[10px] border border-sky-500/30">
              LOCKED ACTIVE
            </span>
          </div>
        </div>

        {/* Section 3: Audio & Voice Synthesis */}
        <div className="p-6 rounded-lg bg-[#111118] border border-[#2a2a3a] text-xs">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-[#2a2a3a]">
            Audio & Voice Synthesis
          </h2>
          <div className="flex items-center justify-between p-3 rounded bg-[#161b22] border border-[#2a2a3a]">
            <div>
              <span className="font-semibold text-white block mb-0.5">
                Victor Speaks Responses (TTS)
              </span>
              <span className="text-slate-400 text-[11px]">
                When enabled, Victor vocalizes responses using a calm, deep synthesized voice.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleTts}
              className={`px-3.5 py-1.5 rounded font-mono font-bold text-xs transition-colors ${
                ttsEnabled
                  ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  : 'bg-[#1a1a24] text-slate-400 border border-[#2a2a3a] hover:text-white'
              }`}
            >
              {ttsEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>

        {/* Section 4: System & Architecture Info */}
        <div className="p-6 rounded-lg bg-[#111118] border border-[#2a2a3a] text-xs space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-[#2a2a3a]">
            Architecture & Authority Telemetry
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div className="p-3 rounded bg-[#161b22] border border-[#2a2a3a]">
              <span className="text-slate-500 block uppercase">Core Intelligence</span>
              <span className="text-white font-bold">Gemini API (S02)</span>
            </div>
            <div className="p-3 rounded bg-[#161b22] border border-[#2a2a3a]">
              <span className="text-slate-500 block uppercase">Memory Fabric</span>
              <span className="text-white font-bold">Postgres Matrix (S03)</span>
            </div>
            <div className="p-3 rounded bg-[#161b22] border border-[#2a2a3a]">
              <span className="text-slate-500 block uppercase">Authority Engine</span>
              <span className="text-sky-400 font-bold">VTE (L0–L4)</span>
            </div>
            <div className="p-3 rounded bg-[#161b22] border border-[#2a2a3a]">
              <span className="text-slate-500 block uppercase">Release Level</span>
              <span className="text-white font-bold">v0.5.0-alpha</span>
            </div>
          </div>
        </div>

        {/* Section 4: Danger Zone */}
        <div className="p-6 rounded-lg bg-red-950/10 border border-red-900/40 text-xs">
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2">
            Danger Zone
          </h2>
          <p className="text-slate-400 mb-4">
            Terminate authenticated session across the active terminal. Requires owner re-authentication to resume Victor interactions.
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-600/40 font-bold tracking-wider transition-colors"
            >
              DISENGAGE & SIGN OUT
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
