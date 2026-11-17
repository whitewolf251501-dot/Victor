'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Memory, MemoryCategory, MemoryImportance } from '@victor/shared';
import { MEMORY_CATEGORIES, MEMORY_IMPORTANCES } from '@victor/shared';

const IMPORTANCE_COLORS: Record<MemoryImportance, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-400',
  high: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  medium: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  low: 'border-slate-500/40 bg-slate-500/10 text-slate-400',
};

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deletingMemory, setDeletingMemory] = useState<Memory | null>(null);

  // Form inputs
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<MemoryCategory>('fact');
  const [formImportance, setFormImportance] = useState<MemoryImportance>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch memories from API
  const fetchMemories = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/victor/memories?limit=100');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to retrieve memories.');
      }
      const data = await res.json();
      setMemories(data.memories ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch memories.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  // Filter memories via search
  const filteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return memories;
    const q = searchQuery.toLowerCase();
    return memories.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.importance.toLowerCase().includes(q)
    );
  }, [memories, searchQuery]);

  // Group by category
  const groupedMemories = useMemo(() => {
    const groups: Partial<Record<MemoryCategory, Memory[]>> = {};
    for (const mem of filteredMemories) {
      if (!groups[mem.category]) {
        groups[mem.category] = [];
      }
      groups[mem.category]!.push(mem);
    }
    return groups;
  }, [filteredMemories]);

  // Toggle category collapsed
  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Add memory submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/victor/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: formContent.trim(),
          category: formCategory,
          importance: formImportance,
          source: 'manual_ui',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create memory.');
      }

      setIsAddModalOpen(false);
      setFormContent('');
      await fetchMemories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating memory.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit memory submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemory || !formContent.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/victor/memories/${editingMemory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: formContent.trim(),
          category: formCategory,
          importance: formImportance,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update memory.');
      }

      setEditingMemory(null);
      await fetchMemories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating memory.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete memory confirm
  const handleDeleteConfirm = async () => {
    if (!deletingMemory) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/victor/memories/${deletingMemory.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete memory.');
      }

      setDeletingMemory(null);
      await fetchMemories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting memory.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#2a2a3a]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <h1 className="text-xl font-bold tracking-wider text-white">
              MEMORY MATRIX (SYSTEM 03)
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Persistent owner neural state: facts, goals, preferences, and directives.
          </p>
        </div>

        <button
          onClick={() => {
            setFormContent('');
            setFormCategory('fact');
            setFormImportance('medium');
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm shadow-sky-500/20"
        >
          <span>+ INJECT MEMORY</span>
        </button>
      </div>

      {/* Search & Statistics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="sm:col-span-2 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter memories by keyword, category, or importance..."
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#161b22] border border-[#2a2a3a] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/60"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-[#111118] border border-[#2a2a3a] text-xs text-slate-400">
          <span>Total Recorded:</span>
          <span className="text-white font-bold">{memories.length}</span>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-4 rounded-lg bg-[#111118] border border-[#2a2a3a] animate-pulse space-y-2"
            >
              <div className="h-4 w-32 bg-[#2a2a3a] rounded" />
              <div className="h-5 w-full bg-[#1a1a24] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && errorMessage && (
        <div className="p-6 rounded-lg bg-red-950/20 border border-red-500/40 text-center text-xs">
          <p className="text-red-400 font-bold mb-2">Memory retrieval error</p>
          <p className="text-slate-400 mb-4">{errorMessage}</p>
          <button
            onClick={fetchMemories}
            className="px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !errorMessage && memories.length === 0 && (
        <div className="p-12 rounded-lg bg-[#111118] border border-[#2a2a3a] text-center">
          <div className="w-12 h-12 rounded-full border border-slate-700 bg-[#1a1a24] mx-auto flex items-center justify-center text-slate-500 mb-3">
            🧠
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">
            Victor hasn&apos;t learned anything yet.
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Start talking to him in chat or click &quot;Inject Memory&quot; to manually record facts, preferences, or project goals.
          </p>
        </div>
      )}

      {/* Grouped Memories View */}
      {!isLoading && !errorMessage && Object.keys(groupedMemories).length > 0 && (
        <div className="space-y-6">
          {(Object.keys(groupedMemories) as MemoryCategory[]).map((category) => {
            const list = groupedMemories[category] ?? [];
            const isCollapsed = collapsedCategories[category];

            return (
              <div
                key={category}
                className="rounded-lg bg-[#111118] border border-[#2a2a3a] overflow-hidden"
              >
                {/* Category Header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3.5 bg-[#161a23] border-b border-[#2a2a3a] text-left hover:bg-[#1a1f2c] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#2a2a3a] text-slate-300 font-semibold">
                      {list.length}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {isCollapsed ? '▼ Expand' : '▲ Collapse'}
                  </span>
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div className="divide-y divide-[#2a2a3a]">
                    {list.map((mem) => (
                      <div
                        key={mem.id}
                        className="p-4 hover:bg-[#161b24] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-slate-100 font-mono break-words leading-relaxed">
                            {mem.content}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span
                              className={`px-2 py-0.5 rounded border uppercase font-semibold ${
                                IMPORTANCE_COLORS[mem.importance]
                              }`}
                            >
                              {mem.importance}
                            </span>
                            <span className="text-slate-500">
                              Source: {mem.source || 'system'}
                            </span>
                            <span className="text-slate-500">
                              Recorded: {new Date(mem.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => {
                              setEditingMemory(mem);
                              setFormContent(mem.content);
                              setFormCategory(mem.category);
                              setFormImportance(mem.importance);
                            }}
                            className="px-2.5 py-1 text-[11px] rounded border border-[#2a2a3a] bg-[#1a1a24] text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeletingMemory(mem)}
                            className="px-2.5 py-1 text-[11px] rounded border border-red-900/40 bg-red-950/20 text-red-400 hover:bg-red-900/40 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Memory Modal */}
      {(isAddModalOpen || editingMemory) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-lg bg-[#111118] border border-[#2a2a3a] shadow-2xl p-6">
            <h2 className="text-sm font-bold text-white tracking-wider mb-4 pb-2 border-b border-[#2a2a3a]">
              {editingMemory ? 'EDIT RECORDED MEMORY' : 'RECORD NEW MEMORY'}
            </h2>

            <form onSubmit={editingMemory ? handleEditSubmit : handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  Memory Content
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Owner prefers dark mode and minimal UI"
                  className="w-full px-3 py-2 rounded bg-[#161b22] border border-[#2a2a3a] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                    className="w-full px-3 py-2 rounded bg-[#161b22] border border-[#2a2a3a] text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {MEMORY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                    Importance
                  </label>
                  <select
                    value={formImportance}
                    onChange={(e) => setFormImportance(e.target.value as MemoryImportance)}
                    className="w-full px-3 py-2 rounded bg-[#161b22] border border-[#2a2a3a] text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {MEMORY_IMPORTANCES.map((imp) => (
                      <option key={imp} value={imp}>
                        {imp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2a2a3a]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingMemory(null);
                  }}
                  className="px-4 py-2 rounded border border-[#2a2a3a] text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formContent.trim()}
                  className="px-4 py-2 rounded bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-lg bg-[#111118] border border-red-500/40 shadow-2xl p-6 text-xs">
            <h3 className="text-sm font-bold text-red-400 tracking-wider mb-2">
              CONFIRM MEMORY PURGE
            </h3>
            <p className="text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to permanently delete this memory? This action removes the vector and keyword data from Victor&apos;s neural vault.
            </p>
            <div className="p-3 rounded bg-[#161b22] border border-[#2a2a3a] mb-6 italic text-slate-400 break-words">
              &quot;{deletingMemory.content}&quot;
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingMemory(null)}
                className="px-3.5 py-1.5 rounded border border-[#2a2a3a] text-slate-300 hover:text-white"
              >
                Abort
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                {isSubmitting ? 'Purging...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
