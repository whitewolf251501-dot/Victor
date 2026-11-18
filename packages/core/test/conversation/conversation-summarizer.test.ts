import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConversationSummarizer } from '../../src/conversation/conversation-summarizer';
import type { Message, MessageId, ConversationId, DeviceId } from '@victor/shared';

function createMockTurn(id: string, role: 'user' | 'assistant', content: string): Message {
  return {
    id: id as MessageId,
    conversationId: 'conv_alpha' as ConversationId,
    deviceId: 'dev_1' as DeviceId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

describe('System 3: ConversationSummarizer Specification Suite', () => {
  it('extracts decisions, open tasks, and constructs factual summary without hallucination', () => {
    const messages: Message[] = [
      createMockTurn('msg_1', 'user', 'I decided to migrate the database to Supabase Postgres.'),
      createMockTurn('msg_2', 'assistant', 'Acknowledged, Commander. Database migration confirmed.'),
      createMockTurn('msg_3', 'user', 'Remind me to backup the audit log table before proceeding.'),
      createMockTurn('msg_4', 'assistant', 'Standing by to verify backup.'),
      createMockTurn('msg_5', 'user', "Let's proceed with creating the backup script."),
    ];

    const summary = ConversationSummarizer.summarizeMessages('conv_alpha', 'owner_1', messages);

    assert.equal(summary.conversationId, 'conv_alpha');
    assert.equal(summary.ownerId, 'owner_1');
    assert.equal(summary.fromMessageId, 'msg_1');
    assert.equal(summary.toMessageId, 'msg_5');

    // Verified extracted decisions
    assert.ok(summary.keyDecisions.length >= 1);
    assert.ok(
      summary.keyDecisions.some((d) => d.toLowerCase().includes('migrate the database to supabase'))
    );

    // Verified extracted open tasks
    assert.ok(summary.openTasks.length >= 1);
    assert.ok(
      summary.openTasks.some((t) => t.toLowerCase().includes('backup the audit log table'))
    );

    // Summary text captures user topics
    assert.ok(summary.summary.includes('User discussed'));
  });

  it('handles empty message arrays safely', () => {
    const summary = ConversationSummarizer.summarizeMessages('conv_empty', 'owner_1', []);
    assert.equal(summary.conversationId, 'conv_empty');
    assert.equal(summary.keyDecisions.length, 0);
    assert.equal(summary.openTasks.length, 0);
    assert.equal(summary.summary, 'No previous messages.');
  });
});
