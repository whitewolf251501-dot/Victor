import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MemoryManager } from '@victor/core';
import {
  type MemoryCategory,
  type MemoryImportance,
  MEMORY_CATEGORIES,
  MEMORY_IMPORTANCES,
} from '@victor/shared';

export interface CreateMemoryBody {
  content?: string;
  category?: MemoryCategory;
  importance?: MemoryImportance;
  source?: string;
}

/**
 * GET /api/victor/memories
 * Returns owner's memories filtered by category, importance, search query, sorted by importance + recency.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Session required to access Victor memories.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');
    const importanceParam = searchParams.get('importance');
    const searchParam = searchParams.get('search');
    const limitParam = searchParams.get('limit');

    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 100) : 50;

    const memoryManager = new MemoryManager(supabase, user.id);

    let memories = searchParam
      ? await memoryManager.retrieve(searchParam, {
          limit,
          category: categoryParam as MemoryCategory | undefined,
          minImportance: importanceParam as MemoryImportance | undefined,
        })
      : await memoryManager.getRecent(limit);

    // Filter by category if not already filtered via retrieve
    if (!searchParam && categoryParam) {
      if (MEMORY_CATEGORIES.includes(categoryParam as MemoryCategory)) {
        memories = memories.filter((m) => m.category === categoryParam);
      }
    }

    // Filter by importance if not already filtered
    if (!searchParam && importanceParam) {
      if (MEMORY_IMPORTANCES.includes(importanceParam as MemoryImportance)) {
        memories = memories.filter((m) => m.importance === importanceParam);
      }
    }

    // Sort by importance weighting + recency
    const importanceScore: Record<MemoryImportance, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    memories.sort((a, b) => {
      const diffImportance = (importanceScore[b.importance] ?? 2) - (importanceScore[a.importance] ?? 2);
      if (diffImportance !== 0) return diffImportance;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ memories: memories.slice(0, limit) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: `[Victor Memory Error] ${message}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/victor/memories
 * Creates a new memory for authenticated owner.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Session required to store memories.' },
        { status: 401 }
      );
    }

    let body: CreateMemoryBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid payload: JSON body required.' },
        { status: 400 }
      );
    }

    const { content, category, importance, source } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation failed: Memory content cannot be empty.' },
        { status: 400 }
      );
    }

    if (!category || !MEMORY_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          error: `Validation failed: Invalid category '${category}'. Allowed values: ${MEMORY_CATEGORIES.join(
            ', '
          )}`,
        },
        { status: 400 }
      );
    }

    if (importance && !MEMORY_IMPORTANCES.includes(importance)) {
      return NextResponse.json(
        {
          error: `Validation failed: Invalid importance '${importance}'. Allowed values: ${MEMORY_IMPORTANCES.join(
            ', '
          )}`,
        },
        { status: 400 }
      );
    }

    const memoryManager = new MemoryManager(supabase, user.id);
    const createdMemory = await memoryManager.save(
      content,
      category,
      importance ?? 'medium',
      source ?? 'user'
    );

    return NextResponse.json({ memory: createdMemory }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: `[Victor Memory Error] ${message}` },
      { status: 500 }
    );
  }
}
