import type { NormalizedIntent, IntentType } from '@victor/shared';

export interface IntentClassifierRule {
  pattern: RegExp;
  type: IntentType;
  capabilityId?: string;
  actionName?: string;
  memoryAction?: 'remember' | 'forget' | 'query' | 'correct';
  extractParams?: (matches: RegExpMatchArray, text: string) => Record<string, unknown>;
  confidence?: number;
}

export class IntentClassifier {
  private static readonly MEMORY_PATTERNS: IntentClassifierRule[] = [
    {
      pattern: /^(?:remember\s+(?:that\s+)?|note\s+(?:that\s+)?|keep\s+in\s+mind\s+(?:that\s+)?)(.+)$/i,
      type: 'memory_command',
      memoryAction: 'remember',
      confidence: 0.95,
      extractParams: (m) => ({ content: m[1].trim() }),
    },
    {
      pattern: /^(?:forget\s+(?:that\s+|about\s+)?|delete\s+memory\s+(?:about\s+|regarding\s+)?)(.+)$/i,
      type: 'memory_command',
      memoryAction: 'forget',
      confidence: 0.95,
      extractParams: (m) => ({ target: m[1].trim() }),
    },
    {
      pattern: /^(?:recall\s+|what\s+do\s+you\s+remember\s+about\s+|what\s+is\s+my\s+)(.+)$/i,
      type: 'memory_command',
      memoryAction: 'query',
      confidence: 0.9,
      extractParams: (m) => ({ query: m[1].trim() }),
    },
    {
      pattern: /^(?:correction:\s*|correct\s+(?:that\s+)?|update\s+memory\s+(?:about\s+)?)(.+)$/i,
      type: 'memory_command',
      memoryAction: 'correct',
      confidence: 0.95,
      extractParams: (m) => ({ correction: m[1].trim() }),
    },
  ];

  private static readonly ACTION_PATTERNS: IntentClassifierRule[] = [
    {
      pattern: /^(?:search\s+(?:the\s+web\s+for\s+|online\s+for\s+|for\s+)?|look\s+up\s+)(.+)$/i,
      type: 'action',
      capabilityId: 'vic.web.search',
      actionName: 'search',
      confidence: 0.9,
      extractParams: (m) => ({ query: m[1].trim() }),
    },
    {
      pattern: /^(?:run|execute|exec)\s+(?:command|terminal)?\s*[:]\s*(.+)$/i,
      type: 'action',
      capabilityId: 'vic.terminal.execute',
      actionName: 'execute',
      confidence: 0.95,
      extractParams: (m) => ({ command: m[1].trim() }),
    },
    {
      pattern: /^(?:wipe|purge)\s+(?:audit\s+log|audit_log|audit\s+records)$/i,
      type: 'action',
      capabilityId: 'vic.system.wipe_audit_log',
      actionName: 'wipe',
      confidence: 0.98,
      extractParams: () => ({ target: 'audit_log' }),
    },
    {
      pattern: /^(?:deploy|publish)\s+(.+)$/i,
      type: 'action',
      capabilityId: 'vic.deployment.deploy',
      actionName: 'deploy',
      confidence: 0.95,
      extractParams: (m) => ({ target: m[1].trim() }),
    },
    {
      pattern: /^(?:reboot|restart)\s+(?:the\s+)?(?:system|server|daemon)$/i,
      type: 'action',
      capabilityId: 'vic.system.reboot',
      actionName: 'reboot',
      confidence: 0.95,
      extractParams: () => ({ target: 'system' }),
    },
  ];

  private static readonly QUERY_PATTERNS: RegExp[] = [
    /^(?:what|who|where|when|why|how)\b/i,
    /^(?:status|health|ping|check|overview|list)\b/i,
    /\?$/,
  ];

  public static classify(input: string): NormalizedIntent {
    const rawText = (input ?? '').trim();
    if (!rawText) {
      return {
        type: 'conversation',
        params: {},
        confidence: 1.0,
        rawText: '',
      };
    }

    // 1. Check Memory Patterns
    for (const rule of this.MEMORY_PATTERNS) {
      const match = rawText.match(rule.pattern);
      if (match) {
        return {
          type: 'memory_command',
          memoryAction: rule.memoryAction,
          params: rule.extractParams ? rule.extractParams(match, rawText) : {},
          confidence: rule.confidence ?? 0.9,
          rawText,
        };
      }
    }

    // 2. Check Explicit Action Directives
    for (const rule of this.ACTION_PATTERNS) {
      const match = rawText.match(rule.pattern);
      if (match) {
        return {
          type: 'action',
          capabilityId: rule.capabilityId,
          actionName: rule.actionName,
          params: rule.extractParams ? rule.extractParams(match, rawText) : {},
          confidence: rule.confidence ?? 0.85,
          rawText,
        };
      }
    }

    // 3. Check Query Patterns
    for (const pattern of this.QUERY_PATTERNS) {
      if (pattern.test(rawText)) {
        return {
          type: 'query',
          params: { query: rawText },
          confidence: 0.8,
          rawText,
        };
      }
    }

    // 4. Default to Conversational Dialogue
    return {
      type: 'conversation',
      params: {},
      confidence: 0.7,
      rawText,
    };
  }
}
