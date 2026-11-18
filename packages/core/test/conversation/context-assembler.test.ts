import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ContextAssembler } from '../../src/conversation/context-assembler';
import type { Message, ConversationSummary, MessageId, ConversationId, DeviceId, OwnerId, ConversationSummaryId } from '@victor/shared';

function createMockMessage(id: string, content: string): Message {
  return {
    id: id as MessageId,
    conversationId: 'conv_1' as ConversationId,
    deviceId: 'dev_1' as DeviceId,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  };
}

describe('System 3: ContextAssembler Specification Suite', () => {
  it('assembles system prompt, memories, summary, and messages within budget', () => {
    const assembler = new ContextAssembler({
      maxTotalChars: 5000,
      maxSystemPromptChars: 1500,
      maxMemoriesChars: 1000,
      maxSummaryChars: 1000,
      maxMessagesChars: 2000,
    });

    const summary: ConversationSummary = {
      id: 'sum_1' as ConversationSummaryId,
      conversationId: 'conv_1' as ConversationId,
      ownerId: 'owner_alpha' as OwnerId,
      summary: 'Owner and Victor planned deployment architecture.',
      keyDecisions: ['Use Next.js 15 App router', 'Deploy with Docker'],
      openTasks: ['Verify SSL certificates'],
      createdAt: new Date().toISOString(),
    };

    const messages = [
      createMockMessage('msg_1', 'Can we review the deployment checklist?'),
      createMockMessage('msg_2', 'All checks look ready for production.'),
    ];

    const result = assembler.assembleContext({
      systemPrompt: 'You are Victor Noctis.',
      memories: '• Owner prefers dark mode tactical HUD.',
      summary,
      messages,
    });

    assert.equal(result.systemPrompt, 'You are Victor Noctis.');
    assert.ok(result.summaryBlock?.includes('Next.js 15 App router'));
    assert.ok(result.memoriesBlock?.includes('tactical HUD'));
    assert.equal(result.messages.length, 2);
    assert.equal(result.budgetExhausted, false);
    assert.ok(result.totalChars > 0 && result.totalChars < 5000);
  });

  it('prunes oldest messages first when message budget is exceeded', () => {
    // Tight message budget: max 100 chars
    const assembler = new ContextAssembler({
      maxTotalChars: 5000,
      maxSystemPromptChars: 1000,
      maxMemoriesChars: 500,
      maxSummaryChars: 500,
      maxMessagesChars: 100,
    });

    const messages = [
      createMockMessage('msg_old_1', 'This is an old message from 10 minutes ago that should be dropped first.'),
      createMockMessage('msg_old_2', 'This is a second old message that should also be dropped.'),
      createMockMessage('msg_new_3', 'Latest urgent directive.'),
    ];

    const result = assembler.assembleContext({
      systemPrompt: 'Victor Noctis Core',
      messages,
    });

    // Oldest messages were dropped to fit inside the 100-char budget
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].id, 'msg_new_3');
    assert.equal(result.budgetExhausted, true);
  });

  it('truncates oversized system prompt and marks budgetExhausted: true', () => {
    const assembler = new ContextAssembler({
      maxSystemPromptChars: 50,
      maxTotalChars: 1000,
    });

    const result = assembler.assembleContext({
      systemPrompt: 'This is an excessively long system prompt that will surely exceed fifty characters in total length.',
      messages: [],
    });

    assert.equal(result.systemPrompt.length, 50);
    assert.equal(result.budgetExhausted, true);
  });
});
