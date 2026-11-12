'use client';

import React, { useState } from 'react';
import { loginWithPassword, loginWithMagicLink } from './actions';

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<'password' | 'magic_link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (authMode === 'password') {
        const result = await loginWithPassword(email, password);
        if (result && !result.success && result.error) {
          setErrorMessage(result.error);
        }
      } else {
        const result = await loginWithMagicLink(email);
        if (result.success) {
          setSuccessMessage(result.message || 'Magic link sent. Check your inbox.');
        } else if (result.error) {
          setErrorMessage(result.error);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Authentication request failed. Please retry.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#090a0f] text-slate-200">
      <div className="w-full max-w-md bg-[#0d1117] border border-[#1f293d] rounded-lg shadow-2xl p-6 sm:p-8">
        {/* Header HUD */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-500/20 bg-sky-500/10 text-sky-400 text-xs font-mono tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            SYSTEM 07 • AUTHENTICATION
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">VICTOR NOCTIS</h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">
            Velmora Intelligence Command
          </p>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#161b22] rounded-md border border-[#1f293d] mb-6">
          <button
            type="button"
            onClick={() => {
              setAuthMode('password');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-2 text-xs font-mono font-medium rounded transition-colors ${
              authMode === 'password'
                ? 'bg-[#1f293d] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PASSWORD
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('magic_link');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-2 text-xs font-mono font-medium rounded transition-colors ${
              authMode === 'magic_link'
                ? 'bg-[#1f293d] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MAGIC LINK
          </button>
        </div>

        {/* Alert Messages */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono">
            [ACCESS DENIED] {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-mono">
            [DISPATCHED] {successMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Owner Identifier / Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@velmora.internal"
              className="w-full px-3.5 py-2.5 rounded bg-[#161b22] border border-[#1f293d] text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono"
            />
          </div>

          {authMode === 'password' && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Passphrase
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded bg-[#161b22] border border-[#1f293d] text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 mt-2 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white text-xs font-mono font-semibold tracking-wider uppercase transition-colors shadow-lg shadow-sky-950/50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>AUTHENTICATING...</span>
              </>
            ) : authMode === 'password' ? (
              'AUTHORIZE ACCESS'
            ) : (
              'SEND MAGIC LINK'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#1f293d] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>STATUS: ONLINE</span>
          <span>PROTOCOL: L0-L4 VTE</span>
        </div>
      </div>
    </main>
  );
}
