'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Victor ErrorBoundary] Uncaught runtime fault:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center p-6 bg-[#0a0a0f] text-slate-200 font-mono">
          <div className="max-w-md w-full p-6 rounded-lg bg-[#111118] border border-red-500/40 shadow-2xl text-center space-y-4">
            <div className="inline-block p-3 rounded-full bg-red-950/40 border border-red-500/50 text-red-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest">
                {this.props.fallbackTitle || 'EXECUTION INTERRUPTED'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {this.state.error?.message || 'A client-side runtime exception occurred in the interface.'}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-colors"
            >
              RE-INITIALIZE INTERFACE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
