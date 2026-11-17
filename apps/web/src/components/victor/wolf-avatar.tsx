'use client';

import React from 'react';

export type WolfState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'success'
  | 'error'
  | 'offline';

export interface WolfAvatarProps {
  state?: WolfState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function WolfAvatar({
  state = 'idle',
  size = 'md',
  className = '',
}: WolfAvatarProps) {
  // Dimension definitions
  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-16 h-16',
    lg: 'w-28 h-28',
  }[size];

  // State styling & ring classes
  const ringClasses: Record<WolfState, string> = {
    idle: 'wolf-ring-idle border-[#2a2a3a] bg-[#111118]/80 text-slate-400',
    listening: 'wolf-ring-listening border-sky-400 bg-sky-950/20 text-sky-400',
    speaking: 'wolf-ring-listening border-sky-400 bg-sky-950/25 text-sky-300',
    thinking: 'wolf-ring-thinking border-purple-500 bg-purple-950/30 text-purple-400',
    success: 'wolf-ring-success border-emerald-500 bg-emerald-950/20 text-emerald-400',
    error: 'wolf-ring-error border-red-500 bg-red-950/20 text-red-400',
    offline: 'border-slate-800 bg-black/60 text-slate-600',
  };

  const eyeColor: Record<WolfState, string> = {
    idle: '#64748b',
    listening: '#38bdf8',
    speaking: '#38bdf8',
    thinking: '#c084fc',
    success: '#34d399',
    error: '#f87171',
    offline: '#334155',
  };

  return (
    <div
      role="img"
      aria-label={`Victor Wolf Companion - State: ${state}`}
      className={`relative rounded-full flex items-center justify-center border transition-all duration-300 select-none ${sizeClasses} ${ringClasses[state]} ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="currentColor"
        className="w-3/4 h-3/4 transition-transform duration-300"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Sleek geometric wolf silhouette */}
        {/* Left ear */}
        <polygon points="28,42 16,15 38,28" opacity="0.9" />
        {/* Right ear */}
        <polygon points="72,42 84,15 62,28" opacity="0.9" />
        {/* Forehead & brow */}
        <polygon points="38,28 50,18 62,28 50,42" opacity="0.85" />
        {/* Left cheek & jaw */}
        <polygon points="28,42 38,28 50,42 42,65 20,55" opacity="0.95" />
        {/* Right cheek & jaw */}
        <polygon points="72,42 62,28 50,42 58,65 80,55" opacity="0.95" />
        {/* Central muzzle bridge */}
        <polygon points="50,42 42,65 50,82 58,65" opacity="1" />
        {/* Nose apex */}
        <polygon points="46,80 54,80 50,86" fill={eyeColor[state]} />
        {/* Piercing Left Eye */}
        <polygon points="35,46 44,48 38,51" fill={eyeColor[state]} />
        {/* Piercing Right Eye */}
        <polygon points="65,46 56,48 62,51" fill={eyeColor[state]} />
      </svg>

      {/* Live status dot on bottom right */}
      <span
        className={`absolute bottom-0 right-0 rounded-full border-2 border-[#0a0a0f] ${
          size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4'
        } ${
          state === 'thinking'
            ? 'bg-purple-500 animate-pulse'
            : state === 'listening' || state === 'speaking'
            ? 'bg-sky-400 animate-ping'
            : state === 'success'
            ? 'bg-emerald-400'
            : state === 'error'
            ? 'bg-red-500'
            : 'bg-emerald-500'
        }`}
      />
    </div>
  );
}
