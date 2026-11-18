import type {
  CoreRequest,
  CoreResponse,
  CapabilityProposal,
  Message,
  MessageId,
  ConversationId,
  DeviceId,
} from '@victor/shared';
import { ModelRouter } from '../model/model-router';
import { IntentClassifier } from './intent-classifier';
import { buildSystemPrompt } from '../personality';
import { CapabilityRegistry } from '../capabilities/capability-registry';
import { BUILTIN_CAPABILITIES } from '../capabilities/builtin-capabilities';

export class VictorCoreError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'VICTOR_CORE_ERROR') {
    super(message);
    this.name = 'VictorCoreError';
    this.code = code;
  }
}

export class VictorCore {
  private readonly router: ModelRouter;
  private readonly capabilityRegistry: CapabilityRegistry;

  constructor(router: ModelRouter, capabilityRegistry?: CapabilityRegistry) {
    if (!router) {
      throw new VictorCoreError('ModelRouter is required to initialize VictorCore.', 'MISSING_ROUTER');
    }
    this.router = router;
    this.capabilityRegistry = capabilityRegistry ?? new CapabilityRegistry(BUILTIN_CAPABILITIES);
  }

  private resolveAuthorityLevel(capabilityId: string): number {
    const cap = this.capabilityRegistry.getCapability(capabilityId);
    if (cap) {
      return cap.authorityLevel;
    }
    // Unknown or unregistered system actions default to L3 (Approval Required) for safety
    return 3;
  }

  private buildProposals(intent: ReturnType<typeof IntentClassifier.classify>): CapabilityProposal[] {
    if (intent.type !== 'action' || !intent.capabilityId) {
      return [];
    }

    const authorityLevel = this.resolveAuthorityLevel(intent.capabilityId);
    const proposal: CapabilityProposal = {
      proposalId: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      capabilityId: intent.capabilityId,
      params: intent.params,
      authorityLevel,
      reason: `Direct action intent detected: ${intent.rawText}`,
    };

    return [proposal];
  }

  public async processRequest(request: CoreRequest): Promise<CoreResponse> {
    if (!request || typeof request.message !== 'string') {
      throw new VictorCoreError('Request message is required and must be a string.', 'INVALID_REQUEST');
    }

    if (!request.identityContext || !request.identityContext.ownerId) {
      throw new VictorCoreError('Valid IdentityContext with ownerId is required.', 'UNAUTHORIZED_CONTEXT');
    }

    // 1. Understand Intent
    const intent = IntentClassifier.classify(request.message);
    const proposals = this.buildProposals(intent);

    // 2. Prepare Context & Framing
    const systemPrompt = buildSystemPrompt({
      ownerName: request.identityContext.ownerId,
      memories: request.contextMemories,
      deviceType: request.deviceType,
    });

    const activeConversationId = (request.conversationId ?? `conv_${Date.now()}`) as ConversationId;
    const activeDeviceId = (request.identityContext.deviceId ?? 'dev_unknown') as DeviceId;

    const messages: Message[] = [
      ...(request.history ?? []),
      {
        id: `msg_${Date.now()}` as MessageId,
        conversationId: activeConversationId,
        deviceId: activeDeviceId,
        role: 'user',
        content: request.message,
        createdAt: new Date().toISOString(),
      },
    ];

    // 3. Route to Model
    const routed = await this.router.generateResponse(messages, systemPrompt);

    return {
      content: routed.content,
      intent,
      proposals,
      metrics: routed.metrics,
    };
  }

  public async *streamRequest(
    request: CoreRequest
  ): AsyncGenerator<{ chunk: string; fallbackUsed: boolean; intent?: ReturnType<typeof IntentClassifier.classify>; proposals?: CapabilityProposal[] }> {
    if (!request || typeof request.message !== 'string') {
      throw new VictorCoreError('Request message is required and must be a string.', 'INVALID_REQUEST');
    }

    if (!request.identityContext || !request.identityContext.ownerId) {
      throw new VictorCoreError('Valid IdentityContext with ownerId is required.', 'UNAUTHORIZED_CONTEXT');
    }

    const intent = IntentClassifier.classify(request.message);
    const proposals = this.buildProposals(intent);

    const systemPrompt = buildSystemPrompt({
      ownerName: request.identityContext.ownerId,
      memories: request.contextMemories,
      deviceType: request.deviceType,
    });

    const activeConversationId = (request.conversationId ?? `conv_${Date.now()}`) as ConversationId;
    const activeDeviceId = (request.identityContext.deviceId ?? 'dev_unknown') as DeviceId;

    const messages: Message[] = [
      ...(request.history ?? []),
      {
        id: `msg_${Date.now()}` as MessageId,
        conversationId: activeConversationId,
        deviceId: activeDeviceId,
        role: 'user',
        content: request.message,
        createdAt: new Date().toISOString(),
      },
    ];

    let first = true;
    for await (const { chunk, fallbackUsed } of this.router.streamResponse(messages, systemPrompt)) {
      if (first) {
        yield { chunk, fallbackUsed, intent, proposals };
        first = false;
      } else {
        yield { chunk, fallbackUsed };
      }
    }
  }
}

