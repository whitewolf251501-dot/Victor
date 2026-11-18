import type {
  Message,
  ConversationSummary,
  ConversationSummaryId,
  ConversationId,
  OwnerId,
} from '@victor/shared';

export class ConversationSummarizer {
  private static readonly DECISION_PATTERNS = [
    /\b(?:decided|chosen|agreed|opted)\s+(?:to|that)?\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    /\b(?:let's\s+proceed\s+with|we\s+will\s+use)\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
  ];

  private static readonly TASK_PATTERNS = [
    /\b(?:todo|task|action\s+item)\s*[:]\s*(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    /\b(?:remind\s+me\s+to|need\s+to|have\s+to)\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
  ];

  public static summarizeMessages(
    conversationId: string,
    ownerId: string,
    messages: Message[]
  ): ConversationSummary {
    if (!messages || messages.length === 0) {
      return {
        id: `sum_${Date.now()}` as ConversationSummaryId,
        conversationId: conversationId as ConversationId,
        ownerId: ownerId as OwnerId,
        summary: 'No previous messages.',
        keyDecisions: [],
        openTasks: [],
        createdAt: new Date().toISOString(),
      };
    }

    const keyDecisions: string[] = [];
    const openTasks: string[] = [];
    const summaryPoints: string[] = [];

    for (const msg of messages) {
      const content = msg.content.trim();

      // Detect Decisions
      for (const pattern of this.DECISION_PATTERNS) {
        const match = pattern.exec(content);
        if (match && match[1]) {
          const decision = match[1].trim();
          if (!keyDecisions.includes(decision)) {
            keyDecisions.push(decision);
          }
        }
      }

      // Detect Tasks
      for (const pattern of this.TASK_PATTERNS) {
        const match = pattern.exec(content);
        if (match && match[1]) {
          const task = match[1].trim();
          if (!openTasks.includes(task)) {
            openTasks.push(task);
          }
        }
      }

      // Collect concise summary bullet points
      if (msg.role === 'user') {
        const firstSentence = content.split(/[.!?]/)[0].trim();
        if (firstSentence.length > 5) {
          summaryPoints.push(`User discussed: ${firstSentence}`);
        }
      }
    }

    const firstMsgId = messages[0].id;
    const lastMsgId = messages[messages.length - 1].id;

    const summaryText =
      summaryPoints.length > 0
        ? summaryPoints.slice(0, 5).join('; ') + '.'
        : `Conversation covered ${messages.length} interaction turns.`;

    return {
      id: `sum_${Date.now()}` as ConversationSummaryId,
      conversationId: conversationId as ConversationId,
      ownerId: ownerId as OwnerId,
      summary: summaryText,
      keyDecisions,
      openTasks,
      fromMessageId: firstMsgId,
      toMessageId: lastMsgId,
      createdAt: new Date().toISOString(),
    };
  }
}
