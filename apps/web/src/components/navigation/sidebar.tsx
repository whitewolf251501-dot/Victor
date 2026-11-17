'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WolfAvatar } from '../victor/wolf-avatar';

const NAV_ITEMS = [
  {
    name: 'Chat',
    href: '/chat',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    name: 'Memories',
    href: '/memories',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar({ ownerName }: { ownerName?: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-[#2a2a3a] bg-[#111118] h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[#2a2a3a]">
        <WolfAvatar state="idle" size="sm" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-wider text-white">
              VICTOR
            </span>
            <span className="px-1.5 py-0.2 text-[10px] font-mono border border-sky-500/30 bg-sky-500/10 text-sky-400 rounded">
              VIC
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 tracking-tight">
            Velmora Intelligence
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-mono transition-colors ${
                isActive
                  ? 'bg-[#1a1a24] text-sky-400 border border-sky-500/30 shadow-sm shadow-sky-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-[#1a1a24]/60'
              }`}
            >
              {item.icon}
              <span className="tracking-wider">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Device & Status Indicator */}
      <div className="p-3 border-t border-[#2a2a3a] bg-[#0a0a0f]/40 font-mono text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-[10px] tracking-wider uppercase text-slate-500">
            System Status
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-semibold">ONLINE</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 truncate">
          Owner: <span className="text-white font-medium">{ownerName || 'Commander'}</span>
        </div>
        <div className="text-[10px] text-slate-500 tracking-widest mt-1">
          AUTHORITY: L0-L4
        </div>
      </div>
    </aside>
  );
}
