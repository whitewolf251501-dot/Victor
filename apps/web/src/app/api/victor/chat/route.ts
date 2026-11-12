import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  GeminiProvider,
  buildSystemPrompt,
  retrieveRelevantMemories,
  formatMemoriesForPrompt,
  getOrCreateConversation,
  getRecentMessages,
} from '@victor/core';
import type { Message, MessageId, DeviceId } from '@victor/shared';

export interface ChatRequestBody {
  message?: string;
  conversationId?: string;
  deviceType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authenticate the request - reject if no valid session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid session required to interact with Victor Noctis.' },
        { status: 401 }
      );
    }

    // 2. Accept body: { message: string, conversationId?: string, deviceType?: string }
    let body: ChatRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid payload: JSON body required.' },
        { status: 400 }
      );
    }

    const { message, conversationId, deviceType } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid directive: Message text cannot be empty.' },
        { status: 400 }
      );
    }

    // Retrieve owner profile display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();

    const ownerName =
      profile?.display_name ??
      user.user_metadata?.display_name ??
      user.email?.split('@')[0] ??
      'Commander';

    // Optional: Resolve or locate an active device for this owner if deviceType provided
    let resolvedDeviceId: string | null = null;
    if (deviceType) {
      const { data: device } = await supabase
        .from('devices')
        .select('id')
        .eq('owner_id', user.id)
        .eq('type', deviceType)
        .order('last_seen', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (device) {
        resolvedDeviceId = device.id;
      }
    }

    // 3. Resolve conversation & retrieve last 20 messages
    const conversation = await getOrCreateConversation(
      supabase,
      user.id,
      resolvedDeviceId,
      conversationId
    );

    const recentMessages = await getRecentMessages(supabase, conversation.id, 20);

    // 4. Retrieve top 10 relevant memories for the owner
    const relevantMemories = await retrieveRelevantMemories(
      supabase,
      user.id,
      message,
      10
    );
    const formattedMemories = formatMemoriesForPrompt(relevantMemories);

    // 5. Build full system prompt
    const systemPrompt = buildSystemPrompt({
      ownerName,
      memories: formattedMemories,
      deviceType: deviceType || 'web',
    });

    // 6. Call Gemini API via gemini.provider.ts
    const historyWithCurrent: Message[] = [
      ...recentMessages,
      {
        id: 'msg-current' as MessageId,
        conversationId: conversation.id,
        role: 'user',
        content: message.trim(),
        deviceId: (resolvedDeviceId ?? '') as DeviceId,
        createdAt: new Date().toISOString(),
      },
    ];

    const gemini = new GeminiProvider();
    let victorResponse: string;

    try {
      victorResponse = await gemini.generateResponse(historyWithCurrent, systemPrompt);
    } catch (genError: unknown) {
      const errorMsg =
        genError instanceof Error ? genError.message : 'Model generation failure';
      // Rule 12: Never return a fake response if Gemini fails - return an error state
      return NextResponse.json(
        {
          error: `[Victor Intelligence Error] Core model failed: ${errorMsg}`,
          conversationId: conversation.id,
        },
        { status: 502 }
      );
    }

    // 7. Save user message to messages table
    const { error: userMsgErr } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      owner_id: user.id,
      role: 'user',
      content: message.trim(),
      device_id: resolvedDeviceId,
    });

    if (userMsgErr) {
      return NextResponse.json(
        { error: `Database failure saving user directive: ${userMsgErr.message}` },
        { status: 500 }
      );
    }

    // 8. Save Victor's response to messages table
    const { data: assistantMsg, error: assistantMsgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        owner_id: user.id,
        role: 'assistant',
        content: victorResponse,
        device_id: resolvedDeviceId,
      })
      .select('id')
      .single();

    if (assistantMsgErr || !assistantMsg) {
      return NextResponse.json(
        {
          error: `Database failure saving intelligence response: ${
            assistantMsgErr?.message ?? 'Unknown error'
          }`,
        },
        { status: 500 }
      );
    }

    // 9. Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    // 10. Return: { response, conversationId, messageId }
    return NextResponse.json({
      response: victorResponse,
      conversationId: conversation.id,
      messageId: assistantMsg.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: `[Victor Internal Error] ${message}` },
      { status: 500 }
    );
  }
}
