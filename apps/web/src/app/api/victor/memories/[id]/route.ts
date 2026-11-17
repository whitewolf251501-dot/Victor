import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MemoryManager } from '@victor/core';
import {
  type MemoryCategory,
  type MemoryImportance,
  MEMORY_CATEGORIES,
  MEMORY_IMPORTANCES,
} from '@victor/shared';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface PatchMemoryBody {
  content?: string;
  category?: MemoryCategory;
  importance?: MemoryImportance;
}

/**
 * GET /api/victor/memories/:id
 * Fetches a single memory for authenticated owner.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    const memoryManager = new MemoryManager(supabase, user.id);
    const memory = await memoryManager.getById(id);

    if (!memory) {
      return NextResponse.json(
        { error: `Memory '${id}' not found or unauthorized.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ memory });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: `[Victor Memory Error] ${message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/victor/memories/:id
 * Partially updates an existing memory for authenticated owner.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Session required to update memory.' },
        { status: 401 }
      );
    }

    let body: PatchMemoryBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid payload: JSON body required.' },
        { status: 400 }
      );
    }

    if (body.content !== undefined && (typeof body.content !== 'string' || body.content.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Validation failed: Memory content cannot be empty.' },
        { status: 400 }
      );
    }

    if (body.category !== undefined && !MEMORY_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        {
          error: `Validation failed: Invalid category '${body.category}'. Allowed values: ${MEMORY_CATEGORIES.join(
            ', '
          )}`,
        },
        { status: 400 }
      );
    }

    if (body.importance !== undefined && !MEMORY_IMPORTANCES.includes(body.importance)) {
      return NextResponse.json(
        {
          error: `Validation failed: Invalid importance '${body.importance}'. Allowed values: ${MEMORY_IMPORTANCES.join(
            ', '
          )}`,
        },
        { status: 400 }
      );
    }

    const memoryManager = new MemoryManager(supabase, user.id);
    const updated = await memoryManager.update(id, {
      content: body.content,
      category: body.category,
      importance: body.importance,
    });

    return NextResponse.json({ memory: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { error: `[Victor Memory Error] ${message}` },
      { status }
    );
  }
}

/**
 * DELETE /api/victor/memories/:id
 * Hard deletes a memory for authenticated owner.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Session required to delete memory.' },
        { status: 401 }
      );
    }

    const memoryManager = new MemoryManager(supabase, user.id);
    await memoryManager.delete(id);

    return NextResponse.json({
      success: true,
      message: `Memory '${id}' successfully deleted.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { error: `[Victor Memory Error] ${message}` },
      { status }
    );
  }
}
