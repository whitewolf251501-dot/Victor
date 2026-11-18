import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: plans, error } = await supabase
      .from('plans')
      .select('id, task_id, owner_id, goal, state, error, created_at, updated_at, completed_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ plans: plans ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { goal, taskId } = body;

    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return NextResponse.json({ error: 'goal string is required' }, { status: 400 });
    }

    // Insert task if not provided
    let effectiveTaskId = taskId;
    if (!effectiveTaskId) {
      const { data: taskData, error: taskErr } = await supabase
        .from('tasks')
        .insert({
          owner_id: user.id,
          description: goal.trim(),
          state: 'planned',
        })
        .select('id')
        .single();

      if (taskErr || !taskData) {
        return NextResponse.json({ error: taskErr?.message ?? 'Failed to initialize task' }, { status: 500 });
      }
      effectiveTaskId = taskData.id;
    }

    const { data: planData, error: planErr } = await supabase
      .from('plans')
      .insert({
        task_id: effectiveTaskId,
        owner_id: user.id,
        goal: goal.trim(),
        state: 'draft',
      })
      .select()
      .single();

    if (planErr || !planData) {
      return NextResponse.json({ error: planErr?.message ?? 'Failed to create plan' }, { status: 500 });
    }

    return NextResponse.json({ plan: planData }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
