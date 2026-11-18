import type { IdentityContext } from './identity';
import type { Message } from './conversation';

export type IntentType = 'action' | 'memory_command' | 'query' | 'conversation';

export interface NormalizedIntent {
  type: IntentType;
  capabilityId?: string;
  actionName?: string;
  memoryAction?: 'remember' | 'forget' | 'query' | 'correct';
  params: Record<string, unknown>;
  confidence: number;
  rawText: string;
}

export interface CapabilityProposal {
  proposalId: string;
  capabilityId: string;
  params: Record<string, unknown>;
  authorityLevel: number;
  reason: string;
}

export interface CoreRequest {
  message: string;
  identityContext: IdentityContext;
  conversationId?: string;
  deviceType?: string;
  history?: Message[];
  contextMemories?: string;
}

export interface ModelRoutingMetrics {
  provider: string;
  model: string;
  fallbackUsed: boolean;
  latencyMs: number;
  timestamp: string;
}

export interface CoreResponse {
  content: string;
  intent: NormalizedIntent;
  proposals: CapabilityProposal[];
  metrics: ModelRoutingMetrics;
}
