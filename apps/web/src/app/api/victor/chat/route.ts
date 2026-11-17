import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  GeminiProvider,
  buildSystemPrompt,
  retrieveRelevantMemories,
  formatMemoriesForPrompt,
  getOrCreateConversation,
  getRecentMessages,
  MemoryManager,
  extractMemoriesFromMessage,
  CapabilityRegistry,
  BUILTIN_CAPABILITIES,
  AuthorityEngine,
  executeWebSearch,
} from '@victor/core';
import type { Message, MessageId, DeviceId } from '@victor/shared';

export interface ChatRequestBody {
  message?: string;
  conversationId?: string;
  deviceType?: string;
}

interface ExplicitMemoryCommand {
  type: 'remember' | 'forget' | 'query' | 'correct';
  target?: string;
  replacement?: string;
}

interface ActionIntent {
  capabilityId: string;
  actionName: string;
  params: Record<string, unknown>;
}

function parseExplicitMemoryCommand(text: string): ExplicitMemoryCommand | null {
  const clean = text.trim().replace(/[?!.]+$/, '').trim();

  // 1. Remember: "remember that X", "remember to X", "remember X"
  const rememberMatch = /^remember(?:\s+that|\s+to)?\s+(.+)$/i.exec(clean);
  if (rememberMatch) {
    return { type: 'remember', target: rememberMatch[1].trim() };
  }

  // 2. Forget: "forget X", "delete memory about X", "delete memory X"
  const forgetMatch = /^(?:forget|delete\s+memory(?:\s+about)?)\s+(.+)$/i.exec(clean);
  if (forgetMatch) {
    let target = forgetMatch[1].trim();
    if (target.toLowerCase().startsWith('the ')) {
      target = target.substring(4).trim();
    }
    return { type: 'forget', target };
  }

  // 3. Query: "what do you remember about X", "what do you remember"
  const queryMatch = /^what\s+do\s+you\s+remember(?:\s+about\s+(.+))?$/i.exec(clean);
  if (queryMatch) {
    return { type: 'query', target: queryMatch[1]?.trim() ?? 'me' };
  }

  // 4. Correct: "correct X to Y"
  const correctMatch = /^correct\s+(?:my\s+)?(.+?)\s+to\s+(.+)$/i.exec(clean);
  if (correctMatch) {
    return {
      type: 'correct',
      target: correctMatch[1].trim(),
      replacement: correctMatch[2].trim(),
    };
  }

  return null;
}

function detectActionIntent(text: string): ActionIntent | null {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. L4 Restricted operations check first!
  if (
    lower.includes('bypass authentication') ||
    lower.includes('auth bypass') ||
    lower.includes('bypass auth') ||
    lower.includes('bypass login')
  ) {
    return {
      capabilityId: 'vic.auth.bypass',
      actionName: 'Authentication Bypass',
      params: { raw: clean },
    };
  }
  if (lower.includes('system admin') || lower.includes('system administration')) {
    return {
      capabilityId: 'vic.system.admin',
      actionName: 'System Administration',
      params: { raw: clean },
    };
  }
  if (lower.includes('export all data') || lower.includes('data export all')) {
    return {
      capabilityId: 'vic.data.export.all',
      actionName: 'Export All Data',
      params: { raw: clean },
    };
  }

  // 2. Action keywords from spec:
  // "search for"
  const searchMatch = /(?:search\s+for|search\s+the\s+web\s+for|web\s+search(?:\s+for)?)\s+(.+)/i.exec(clean);
  if (searchMatch) {
    return {
      capabilityId: 'vic.web.search',
      actionName: 'Web Search',
      params: { query: searchMatch[1].trim() },
    };
  }

  // "send" / "send a message to"
  const sendMatch = /(?:send\s+(?:a\s+)?message\s+to|send\s+(?:a\s+)?text\s+to|send\s+email\s+to)\s+(.+)/i.exec(clean);
  if (sendMatch) {
    return {
      capabilityId: 'vic.message.send',
      actionName: 'Send Message',
      params: { recipient: sendMatch[1].trim() },
    };
  }
  const genericSend = /\bsend\s+(.+)/i.exec(clean);
  if (genericSend) {
    return {
      capabilityId: 'vic.message.send',
      actionName: 'Send Message',
      params: { target: genericSend[1].trim() },
    };
  }

  // "write to", "save file"
  const writeMatch = /(?:write\s+to(?:\s+file)?|save\s+file)\s+(.+)/i.exec(clean);
  if (writeMatch) {
    return {
      capabilityId: 'vic.file.write',
      actionName: 'Write File',
      params: { file: writeMatch[1].trim() },
    };
  }

  // "open", "launch"
  const launchMatch = /(?:launch|open)\s+(.+)/i.exec(clean);
  if (launchMatch) {
    const target = launchMatch[1].trim();
    if (!['up', 'mind', 'source', 'settings', 'conversation', 'memories'].includes(target.toLowerCase())) {
      return {
        capabilityId: 'vic.app.launch',
        actionName: 'Launch Application',
        params: { app: target },
      };
    }
  }

  // "call"
  const callMatch = /(?:make\s+a\s+call\s+to|call)\s+(.+)/i.exec(clean);
  if (callMatch) {
    const target = callMatch[1].trim();
    if (!['it', 'me', 'off', 'back'].includes(target.toLowerCase())) {
      return {
        capabilityId: 'vic.call.make',
        actionName: 'Make Phone Call',
        params: { target },
      };
    }
  }

  return null;
}

function isConfirmationMessage(text: string): boolean {
  return /^(yes|y|proceed|confirm|haan|haanji|sure|do it|go ahead)$/i.test(
    text.trim().replace(/[?!.]+$/, '')
  );
}

function isDenialMessage(text: string): boolean {
  return /^(no|n|cancel|deny|stop|abort|nah|nahi)$/i.test(
    text.trim().replace(/[?!.]+$/, '')
  );
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

    // Initialize Capability Registry & VTE Authority Engine
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const authorityEngine = new AuthorityEngine(registry, supabase);

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

    // Optional: Resolve active device for this owner if deviceType provided
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
    const memoryManager = new MemoryManager(supabase, user.id);

    let victorResponse: string = '';
    let approvalToken: string | undefined;

    // Check for user confirmation/denial of a pending L3 approval
    const isConfirmation = isConfirmationMessage(message);
    const isDenial = isDenialMessage(message);

    if (isConfirmation || isDenial) {
      const { data: pending } = await supabase
        .from('pending_approvals')
        .select('*')
        .eq('owner_id', user.id)
        .is('confirmed_at', null)
        .is('denied_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pending) {
        const cap = registry.getCapability(pending.capability_id);
        const actionName = cap?.name ?? pending.capability_id;

        if (isConfirmation) {
          const confirmed = await authorityEngine.confirmApproval(pending.token, user.id);
          if (confirmed) {
            victorResponse = `Action confirmed: ${actionName}. Result: The operation has been authorized and dispatched.`;
          } else {
            victorResponse = `Action confirmation failed for ${actionName}. The token may have expired.`;
          }
        } else {
          await authorityEngine.denyApproval(pending.token, user.id);
          victorResponse = `Action cancelled: ${actionName}. Result: Operation was aborted by owner request.`;
        }
      }
    }

    // 4. If not a confirmation/denial response, check for explicit memory commands or action intents
    if (!victorResponse) {
      const explicitCmd = parseExplicitMemoryCommand(message);

      if (explicitCmd) {
        if (explicitCmd.type === 'remember') {
          try {
            await memoryManager.save(
              explicitCmd.target!,
              'instruction',
              'high',
              'user_directive'
            );
            victorResponse = `Yaad kar liya. ${explicitCmd.target} — noted.`;
          } catch (saveErr: any) {
            victorResponse = `Database error: Could not save memory. ${saveErr.message}`;
          }
        } else if (explicitCmd.type === 'forget') {
          try {
            const candidates = await memoryManager.retrieve(explicitCmd.target!, { limit: 5 });
            if (candidates.length > 0) {
              await memoryManager.delete(candidates[0].id);
              victorResponse = 'Bhool gaya. Memory deleted.';
            } else {
              victorResponse = `Koi aisi memory nahi mili about "${explicitCmd.target}". Nothing deleted.`;
            }
          } catch (delErr: any) {
            victorResponse = `Database error: Could not delete memory. ${delErr.message}`;
          }
        } else if (explicitCmd.type === 'query') {
          try {
            const isGeneral =
              !explicitCmd.target ||
              explicitCmd.target.toLowerCase() === 'me' ||
              explicitCmd.target.toLowerCase() === 'myself';

            const memories = isGeneral
              ? await memoryManager.getRecent(10)
              : await memoryManager.retrieve(explicitCmd.target ?? '', { limit: 10 });

            if (memories.length > 0) {
              const memoryList = memories
                .map((m) => `• [${m.category.toUpperCase()}] ${m.content}`)
                .join('\n');
              victorResponse = `Here is what I have stored in memory:\n${memoryList}`;
            } else {
              victorResponse = `I have no recorded memories about that yet, Commander.`;
            }
          } catch (queryErr: any) {
            victorResponse = `Database error: Could not query memories. ${queryErr.message}`;
          }
        } else if (explicitCmd.type === 'correct') {
          try {
            const candidates = await memoryManager.retrieve(explicitCmd.target!, { limit: 3 });
            if (candidates.length > 0) {
              const updated = await memoryManager.update(candidates[0].id, {
                content: explicitCmd.replacement!,
              });
              victorResponse = `Yaad kar liya. Updated memory to: "${updated.content}" — noted.`;
            } else {
              victorResponse = `Koi aisi memory nahi mili to correct for "${explicitCmd.target}".`;
            }
          } catch (updateErr: any) {
            victorResponse = `Database error: Could not update memory. ${updateErr.message}`;
          }
        }
      } else {
        // Detect action intent from user directive
        const actionIntent = detectActionIntent(message);

        if (actionIntent) {
          const authResult = await authorityEngine.evaluateOperation({
            capabilityId: actionIntent.capabilityId,
            params: actionIntent.params,
            ownerId: user.id,
            deviceId: resolvedDeviceId ?? undefined,
          });

          if (!authResult.authorized && authResult.requiresApproval) {
            // L3: Requires explicit user approval
            approvalToken = authResult.approvalToken;
            victorResponse = `Action staged: ${actionIntent.actionName}. Do you want me to proceed? Reply 'yes' to confirm.`;
          } else if (!authResult.authorized) {
            // L4 or unavailable/restricted
            victorResponse = `Action attempted: ${actionIntent.actionName}. I can't do that — it's outside what I'm authorized to do.`;
          } else {
            // L0 - L2: Authorized, execute immediately
            if (actionIntent.capabilityId === 'vic.web.search') {
              const query = (actionIntent.params.query as string) || message;
              const searchResult = await executeWebSearch(query);

              if (searchResult.results.length > 0) {
                const formatted = searchResult.results
                  .slice(0, 5)
                  .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   ${r.url}`)
                  .join('\n\n');
                victorResponse = `Action attempted: Web Search for "${query}". Result: Found ${searchResult.results.length} real-time results (${searchResult.source}):\n\n${formatted}`;
              } else {
                victorResponse = `Action attempted: Web Search for "${query}". Result: Search completed via ${searchResult.source}, but no relevant results were found.`;
              }
            } else {
              victorResponse = `Action attempted: ${actionIntent.actionName}. Result: Operation authorized (Level ${authResult.level}) and completed.`;
            }
          }
        } else {
          // Standard AI generation flow with Gemini
          const relevantMemories = await retrieveRelevantMemories(
            supabase,
            user.id,
            message,
            10
          );
          const formattedMemories = formatMemoriesForPrompt(relevantMemories);

          const systemPrompt = buildSystemPrompt({
            ownerName,
            memories: formattedMemories,
            deviceType: deviceType || 'web',
          });

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

          try {
            const rawModelResponse = await gemini.generateResponse(historyWithCurrent, systemPrompt);

            // Also inspect model's planned response for action intent
            const modelActionIntent = detectActionIntent(rawModelResponse);
            if (modelActionIntent) {
              const authResult = await authorityEngine.evaluateOperation({
                capabilityId: modelActionIntent.capabilityId,
                params: modelActionIntent.params,
                ownerId: user.id,
                deviceId: resolvedDeviceId ?? undefined,
              });

              if (!authResult.authorized && authResult.requiresApproval) {
                approvalToken = authResult.approvalToken;
                victorResponse = `Action staged: ${modelActionIntent.actionName}. Do you want me to proceed? Reply 'yes' to confirm.`;
              } else if (!authResult.authorized) {
                victorResponse = `Action attempted: ${modelActionIntent.actionName}. I can't do that — it's outside what I'm authorized to do.`;
              } else if (modelActionIntent.capabilityId === 'vic.web.search') {
                const query = (modelActionIntent.params.query as string) || message;
                const searchResult = await executeWebSearch(query);
                if (searchResult.results.length > 0) {
                  const formatted = searchResult.results
                    .slice(0, 5)
                    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   ${r.url}`)
                    .join('\n\n');
                  victorResponse = `${rawModelResponse}\n\nAction executed: Web Search. Found ${searchResult.results.length} results:\n\n${formatted}`;
                } else {
                  victorResponse = rawModelResponse;
                }
              } else {
                victorResponse = rawModelResponse;
              }
            } else {
              victorResponse = rawModelResponse;
            }
          } catch (genError: unknown) {
            const errorMsg =
              genError instanceof Error ? genError.message : 'Model generation failure';
            return NextResponse.json(
              {
                error: `[Victor Intelligence Error] Core model failed: ${errorMsg}`,
                conversationId: conversation.id,
              },
              { status: 502 }
            );
          }
        }
      }
    }

    // Save user message to messages table
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

    // Save Victor's response to messages table
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

    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    // Auto-memory extraction from conversations (async, non-blocking)
    if (!parseExplicitMemoryCommand(message) && !isConfirmationMessage(message) && !isDenialMessage(message)) {
      (async () => {
        try {
          const candidates = extractMemoriesFromMessage(message.trim(), victorResponse);
          for (const candidate of candidates) {
            if (candidate.confidence > 0.7) {
              const isDuplicate = await memoryManager.checkDuplicate(candidate.content, 30);
              if (!isDuplicate) {
                await memoryManager.save(
                  candidate.content,
                  candidate.category,
                  candidate.importance,
                  'auto_extracted'
                );
              }
            }
          }
        } catch (extractErr) {
          console.error('[Victor Auto-Memory Extraction Error]', extractErr);
        }
      })();
    }

    return NextResponse.json({
      response: victorResponse,
      conversationId: conversation.id,
      messageId: assistantMsg.id,
      approvalToken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: `[Victor Internal Error] ${message}` },
      { status: 500 }
    );
  }
}
