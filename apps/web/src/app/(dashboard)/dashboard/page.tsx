'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { WolfAvatar } from '@/components/victor/wolf-avatar';

interface DashboardStats {
  deviceCount: number | null;
  devicesError: string | null;
  conversations: any[];
  conversationsError: string | null;
  memoriesTotal: number | null;
  memoriesByCategory: Record<string, number>;
  memoriesError: string | null;
  tasks: any[];
  tasksError: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    deviceCount: null,
    devicesError: null,
    conversations: [],
    conversationsError: null,
    memoriesTotal: null,
    memoriesByCategory: {},
    memoriesError: null,
    tasks: [],
    tasksError: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);

    // 1. Fetch devices
    let devCount: number | null = null;
    let devErr: string | null = null;
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data = await res.json();
        devCount = data.devices?.length ?? 0;
      } else {
        const err = await res.json();
        devErr = err.error || 'Failed to load devices';
      }
    } catch {
      devErr = 'Devices endpoint unreachable';
    }

    // 2. Fetch conversations
    let convList: any[] = [];
    let convErr: string | null = null;
    try {
      const res = await fetch('/api/victor/conversations');
      if (res.ok) {
        const data = await res.json();
        convList = (data.conversations ?? []).slice(0, 5);
      } else {
        const err = await res.json();
        convErr = err.error || 'Failed to load conversations';
      }
    } catch {
      convErr = 'Conversations endpoint unreachable';
    }

    // 3. Fetch memories
    let memTotal: number | null = null;
    let memByCat: Record<string, number> = {};
    let memErr: string | null = null;
    try {
      const res = await fetch('/api/victor/memories?limit=100');
      if (res.ok) {
        const data = await res.json();
        const mems = data.memories ?? [];
        memTotal = mems.length;
        mems.forEach((m: any) => {
          memByCat[m.category] = (memByCat[m.category] || 0) + 1;
        });
      } else {
        const err = await res.json();
        memErr = err.error || 'Failed to load memories';
      }
    } catch {
      memErr = 'Memories endpoint unreachable';
    }

    // 4. Fetch tasks
    let taskList: any[] = [];
    let taskErr: string | null = null;
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        taskList = (data.tasks ?? []).slice(0, 5);
      } else {
        const err = await res.json();
        taskErr = err.error || 'Failed to load tasks';
      }
    } catch {
      taskErr = 'Tasks endpoint unreachable';
    }

    setStats({
      deviceCount: devCount,
      devicesError: devErr,
      conversations: convList,
      conversationsError: convErr,
      memoriesTotal: memTotal,
      memoriesByCategory: memByCat,
      memoriesError: memErr,
      tasks: taskList,
      tasksError: taskErr,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto font-mono text-slate-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#2a2a3a]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h1 className="text-xl font-bold tracking-wider text-white">
              VICTOR COMMAND OVERVIEW
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Real-time telemetry across devices, memory graph, and execution state.
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          className="px-3.5 py-1.5 rounded border border-[#2a2a3a] hover:border-slate-500 bg-[#161b22] text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-2 self-start sm:self-center"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Sync Telemetry</span>
        </button>
      </div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Victor Status */}
        <div className="p-4 rounded-lg bg-[#111118] border border-[#2a2a3a] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">
              Core Status
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <WolfAvatar state="idle" size="sm" />
            <div>
              <div className="text-sm font-bold text-emerald-400">Victor is Ready</div>
              <div className="text-[10px] text-slate-500">{currentTime || 'ONLINE'}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Active Devices */}
        <div className="p-4 rounded-lg bg-[#111118] border border-[#2a2a3a] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">
              Active Devices
            </span>
            <span className="text-slate-500 text-xs">📱/💻</span>
          </div>
          {stats.devicesError ? (
            <div className="text-xs text-red-400">{stats.devicesError}</div>
          ) : isLoading ? (
            <div className="h-6 w-12 bg-[#2a2a3a] rounded animate-pulse" />
          ) : (
            <div>
              <div className="text-2xl font-bold text-white">
                {stats.deviceCount ?? 0}
              </div>
              <div className="text-[10px] text-slate-500">Authorized Nodes</div>
            </div>
          )}
        </div>

        {/* Card 3: Memory Count */}
        <div className="p-4 rounded-lg bg-[#111118] border border-[#2a2a3a] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">
              Memory Vault
            </span>
            <Link
              href="/memories"
              className="text-[10px] text-sky-400 hover:underline"
            >
              Inspect →
            </Link>
          </div>
          {stats.memoriesError ? (
            <div className="text-xs text-red-400">{stats.memoriesError}</div>
          ) : isLoading ? (
            <div className="h-6 w-12 bg-[#2a2a3a] rounded animate-pulse" />
          ) : (
            <div>
              <div className="text-2xl font-bold text-white">
                {stats.memoriesTotal ?? 0}
              </div>
              <div className="text-[10px] text-slate-500">
                {Object.keys(stats.memoriesByCategory).length} Categories Active
              </div>
            </div>
          )}
        </div>

        {/* Card 4: Authority Scope */}
        <div className="p-4 rounded-lg bg-[#111118] border border-[#2a2a3a] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">
              Authority Level
            </span>
            <span className="text-xs text-sky-400 font-bold">VTE</span>
          </div>
          <div>
            <div className="text-sm font-bold text-sky-400">L0–L4 Engine</div>
            <div className="text-[10px] text-slate-500">Strict Owner Approvals</div>
          </div>
        </div>
      </div>

      {/* Main Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory Categories Distribution */}
        <div className="p-5 rounded-lg bg-[#111118] border border-[#2a2a3a]">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-[#2a2a3a]">
            Memory Category Distribution
          </h3>
          {stats.memoriesError ? (
            <div className="text-xs text-red-400 p-4">{stats.memoriesError}</div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-8 bg-[#1a1a24] rounded animate-pulse" />
              ))}
            </div>
          ) : Object.keys(stats.memoriesByCategory).length === 0 ? (
            <p className="text-xs text-slate-500 p-4">No memories recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(stats.memoriesByCategory).map(([cat, count]) => {
                const pct =
                  stats.memoriesTotal && stats.memoriesTotal > 0
                    ? Math.round((count / stats.memoriesTotal) * 100)
                    : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="uppercase text-slate-300 font-semibold">{cat}</span>
                      <span className="text-slate-400">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#1a1a24] overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Conversations */}
        <div className="p-5 rounded-lg bg-[#111118] border border-[#2a2a3a]">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2a2a3a]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Recent Threads
            </h3>
            <Link href="/chat" className="text-[10px] text-sky-400 hover:underline">
              Open Chat →
            </Link>
          </div>
          {stats.conversationsError ? (
            <div className="text-xs text-red-400 p-4">{stats.conversationsError}</div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 bg-[#1a1a24] rounded animate-pulse" />
              ))}
            </div>
          ) : stats.conversations.length === 0 ? (
            <p className="text-xs text-slate-500 p-4">No recent threads recorded.</p>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {stats.conversations.map((c) => (
                <div
                  key={c.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <div className="font-semibold text-slate-200 truncate">
                      {c.title || `Thread ${c.id.substring(0, 8)}`}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(c.updated_at || c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Link
                    href="/chat"
                    className="px-2 py-1 text-[10px] rounded border border-[#2a2a3a] hover:border-sky-500/40 text-slate-400 hover:text-white"
                  >
                    Resume
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Execution Tasks */}
        <div className="lg:col-span-2 p-5 rounded-lg bg-[#111118] border border-[#2a2a3a]">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-[#2a2a3a]">
            Recent Execution Tasks (VTE)
          </h3>
          {stats.tasksError ? (
            <div className="text-xs text-red-400 p-4">{stats.tasksError}</div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((n) => (
                <div key={n} className="h-10 bg-[#1a1a24] rounded animate-pulse" />
              ))}
            </div>
          ) : stats.tasks.length === 0 ? (
            <p className="text-xs text-slate-500 p-4">No active or pending tasks in pipeline.</p>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {stats.tasks.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">{t.description}</div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] border border-[#2a2a3a] uppercase font-bold text-slate-400">
                    {t.state || 'PENDING'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
