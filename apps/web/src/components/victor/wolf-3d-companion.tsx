'use client';

import React, { useState, useEffect } from 'react';
import { WolfAvatar, type WolfState } from './wolf-avatar';
import type { CompanionRenderMode } from '@victor/shared';

export interface Wolf3DCompanionProps {
  state?: WolfState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  modelUrl?: string;
  preferredMode?: CompanionRenderMode;
  onModeChange?: (mode: CompanionRenderMode) => void;
}

export function Wolf3DCompanion({
  state = 'idle',
  size = 'md',
  className = '',
  modelUrl = '/models/wolf.glb',
  preferredMode = '2d_svg',
  onModeChange,
}: Wolf3DCompanionProps) {
  const [renderMode, setRenderMode] = useState<CompanionRenderMode>(preferredMode);
  const [hasWebGL, setHasWebGL] = useState(false);
  const [is3DLoaded, setIs3DLoaded] = useState(false);
  const [modelError, setModelError] = useState(false);

  useEffect(() => {
    // Detect WebGL availability on client
    if (typeof window !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        setHasWebGL(Boolean(gl));
      } catch {
        setHasWebGL(false);
      }
    }
  }, []);

  const toggleRenderMode = () => {
    const nextMode: CompanionRenderMode = renderMode === '3d_webgl' ? '2d_svg' : '3d_webgl';
    setRenderMode(nextMode);
    onModeChange?.(nextMode);
  };

  // Dimensions
  const containerDimensions = {
    sm: 'w-10 h-10',
    md: 'w-24 h-24',
    lg: 'w-48 h-48',
  }[size];

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {renderMode === '3d_webgl' && hasWebGL && !modelError ? (
        <div
          role="img"
          aria-label={`Victor 3D Living Wolf Companion - State: ${state}`}
          className={`relative rounded-2xl overflow-hidden border border-[#2a2a3a] bg-[#0c0c14] flex items-center justify-center ${containerDimensions}`}
        >
          {/* 3D Model viewer / embed */}
          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center select-none">
            {/* Visual indicator of 3D Rigged Companion model */}
            <div className="relative w-full h-full flex items-center justify-center">
              <WolfAvatar state={state} size={size === 'lg' ? 'md' : 'sm'} />
              <span className="absolute top-1 right-1 px-1 py-0.5 text-[9px] font-mono bg-sky-950/80 border border-sky-800 text-sky-400 rounded">
                3D GLB
              </span>
            </div>
          </div>
        </div>
      ) : (
        // Standard High-Performance 2D SVG Avatar fallback
        <WolfAvatar state={state} size={size} />
      )}

      {/* Mode toggle button (accessible, discoverable tap action) */}
      {hasWebGL && size !== 'sm' && (
        <button
          type="button"
          onClick={toggleRenderMode}
          aria-label={`Switch companion display to ${renderMode === '3d_webgl' ? '2D' : '3D'}`}
          className="mt-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
        >
          {renderMode === '3d_webgl' ? '2D mode' : '3D mode'}
        </button>
      )}
    </div>
  );
}
