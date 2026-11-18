import type {
  Message,
  ConversationSummary,
  ContextBudget,
  AssembledContext,
} from '@victor/shared';

export interface ContextAssemblyRequest {
  systemPrompt: string;
  memories?: string;
  summary?: ConversationSummary | null;
  messages: Message[];
  activeTasks?: string[];
  deviceContext?: string;
}

export class ContextAssembler {
  private readonly defaultBudget: Required<ContextBudget> = {
    maxTotalChars: 6000,
    maxSystemPromptChars: 2000,
    maxMemoriesChars: 1500,
    maxSummaryChars: 1000,
    maxMessagesChars: 2500,
  };

  private readonly budget: Required<ContextBudget>;

  constructor(customBudget: ContextBudget = {}) {
    this.budget = {
      maxTotalChars: customBudget.maxTotalChars ?? this.defaultBudget.maxTotalChars,
      maxSystemPromptChars: customBudget.maxSystemPromptChars ?? this.defaultBudget.maxSystemPromptChars,
      maxMemoriesChars: customBudget.maxMemoriesChars ?? this.defaultBudget.maxMemoriesChars,
      maxSummaryChars: customBudget.maxSummaryChars ?? this.defaultBudget.maxSummaryChars,
      maxMessagesChars: customBudget.maxMessagesChars ?? this.defaultBudget.maxMessagesChars,
    };
  }

  public assembleContext(request: ContextAssemblyRequest): AssembledContext {
    let budgetExhausted = false;

    // 1. Process System Prompt (High Priority)
    let systemPrompt = (request.systemPrompt ?? '').trim();
    if (systemPrompt.length > this.budget.maxSystemPromptChars) {
      systemPrompt = systemPrompt.substring(0, this.budget.maxSystemPromptChars);
      budgetExhausted = true;
    }

    // 2. Process Summary Block
    let summaryBlock: string | undefined;
    if (request.summary) {
      const summaryParts: string[] = [`SUMMARY OF PREVIOUS CONTEXT:\n${request.summary.summary}`];
      if (request.summary.keyDecisions && request.summary.keyDecisions.length > 0) {
        summaryParts.push(`Key Decisions:\n${request.summary.keyDecisions.map((d) => `• ${d}`).join('\n')}`);
      }
      if (request.summary.openTasks && request.summary.openTasks.length > 0) {
        summaryParts.push(`Open Loops / Tasks:\n${request.summary.openTasks.map((t) => `• ${t}`).join('\n')}`);
      }
      let fullSummary = summaryParts.join('\n\n');
      if (fullSummary.length > this.budget.maxSummaryChars) {
        fullSummary = fullSummary.substring(0, this.budget.maxSummaryChars);
        budgetExhausted = true;
      }
      summaryBlock = fullSummary;
    }

    // 3. Process Memories Block
    let memoriesBlock: string | undefined;
    if (request.memories && request.memories.trim().length > 0) {
      let trimmedMem = request.memories.trim();
      if (trimmedMem.length > this.budget.maxMemoriesChars) {
        trimmedMem = trimmedMem.substring(0, this.budget.maxMemoriesChars);
        budgetExhausted = true;
      }
      memoriesBlock = trimmedMem;
    }

    // 4. Process Recent Messages (Newest messages get priority; drop oldest messages to fit budget)
    const rawMessages = request.messages ?? [];
    const includedMessages: Message[] = [];
    let messagesChars = 0;

    // Calculate fixed overhead from system prompt, summary, and memories
    const fixedChars =
      systemPrompt.length +
      (summaryBlock ? summaryBlock.length : 0) +
      (memoriesBlock ? memoriesBlock.length : 0);

    const availableForMessages = Math.min(
      this.budget.maxMessagesChars,
      Math.max(0, this.budget.maxTotalChars - fixedChars)
    );

    // Iterate backwards from newest message to oldest
    for (let i = rawMessages.length - 1; i >= 0; i--) {
      const msg = rawMessages[i];
      const msgLen = (msg.content?.length ?? 0) + 20; // roughly account for role/envelope
      if (messagesChars + msgLen <= availableForMessages) {
        includedMessages.unshift(msg);
        messagesChars += msgLen;
      } else {
        budgetExhausted = true;
        break;
      }
    }

    const totalChars = fixedChars + messagesChars;

    return {
      systemPrompt,
      summaryBlock,
      memoriesBlock,
      messages: includedMessages,
      totalChars,
      budgetExhausted,
      assembledAt: new Date().toISOString(),
    };
  }
}
