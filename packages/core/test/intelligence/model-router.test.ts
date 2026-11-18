import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRouter, ModelRouterError } from '../../src/model/model-router';
import { DeterministicProvider } from '../../src/model/deterministic-provider';
import type { ModelProvider } from '../../src/model/provider.interface';
import type { Message, MessageId, ConversationId, DeviceId } from '@victor/shared';

function createDummyMessage(content: string): Message {
  return {
    id: 'msg_1' as MessageId,
    conversationId: 'conv_1' as ConversationId,
    deviceId: 'dev_1' as DeviceId,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  };
}

class FlakyProvider implements ModelProvider {
  public failCount: number = 0;
  constructor(private readonly shouldThrow: boolean = false, private readonly delayMs: number = 0) {}

  public getModelName(): string {
    return 'flaky-test-model';
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async generateResponse(_messages: Message[], _systemPrompt: string): Promise<string> {
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    if (this.shouldThrow) {
      this.failCount++;
      throw new Error('Upstream provider rate limited or down');
    }
    return 'Flaky response generated.';
  }

  public async *streamResponse(_messages: Message[], _systemPrompt: string): AsyncGenerator<string> {
    if (this.shouldThrow) {
      throw new Error('Upstream streaming failure');
    }
    yield 'Flaky stream chunk';
  }
}

class UnavailableProvider implements ModelProvider {
  public getModelName(): string {
    return 'offline-model';
  }
  public async isAvailable(): Promise<boolean> {
    return false;
  }
  public async generateResponse(): Promise<string> {
    throw new Error('Offline');
  }
  public async *streamResponse(): AsyncGenerator<string> {
    throw new Error('Offline');
  }
}

describe('System 1: ModelRouter Specification Suite', () => {
  it('successfully routes to primary provider and captures latency metrics', async () => {
    const primary = new DeterministicProvider({
      modelName: 'primary-model',
      defaultResponse: 'Primary model response',
      responseDelayMs: 10,
    });
    const fallback = new DeterministicProvider({ modelName: 'fallback-model', defaultResponse: 'Fallback response' });

    const router = new ModelRouter({ primary, fallback, timeoutMs: 1000 });
    const messages = [createDummyMessage('Status check')];

    const result = await router.generateResponse(messages, 'System instructions');

    assert.equal(result.content, 'Primary model response');
    assert.equal(result.metrics.model, 'primary-model');
    assert.equal(result.metrics.fallbackUsed, false);
    assert.ok(result.metrics.latencyMs >= 10);
    assert.ok(result.metrics.timestamp);
  });

  it('fails over to fallback provider when primary throws an error', async () => {
    const primary = new FlakyProvider(true);
    const fallback = new DeterministicProvider({
      modelName: 'fallback-deterministic',
      defaultResponse: 'Fallback deterministic answer',
    });

    const router = new ModelRouter({ primary, fallback, timeoutMs: 1000 });
    const messages = [createDummyMessage('Execute fallback test')];

    const result = await router.generateResponse(messages, 'System instructions');

    assert.equal(result.content, 'Fallback deterministic answer');
    assert.equal(result.metrics.model, 'fallback-deterministic');
    assert.equal(result.metrics.fallbackUsed, true);
    assert.equal(primary.failCount, 1);
  });

  it('fails over to fallback provider when primary provider times out', async () => {
    // Primary has 200ms delay, router timeout is set to 50ms
    const primary = new FlakyProvider(false, 200);
    const fallback = new DeterministicProvider({
      modelName: 'fallback-after-timeout',
      defaultResponse: 'Fallback reached after primary timeout',
    });

    const router = new ModelRouter({ primary, fallback, timeoutMs: 50 });
    const messages = [createDummyMessage('Quick response needed')];

    const result = await router.generateResponse(messages, 'System instructions');

    assert.equal(result.content, 'Fallback reached after primary timeout');
    assert.equal(result.metrics.model, 'fallback-after-timeout');
    assert.equal(result.metrics.fallbackUsed, true);
    assert.ok(result.metrics.latencyMs >= 50);
  });

  it('immediately skips primary and uses fallback if primary isAvailable returns false', async () => {
    const primary = new UnavailableProvider();
    const fallback = new DeterministicProvider({
      modelName: 'fallback-ready',
      defaultResponse: 'Direct fallback answer',
    });

    const router = new ModelRouter({ primary, fallback, timeoutMs: 1000 });
    const messages = [createDummyMessage('Hello')];

    const result = await router.generateResponse(messages, 'System instructions');

    assert.equal(result.content, 'Direct fallback answer');
    assert.equal(result.metrics.model, 'fallback-ready');
    assert.equal(result.metrics.fallbackUsed, true);
  });

  it('throws ModelRouterError if primary fails and no fallback is configured', async () => {
    const primary = new FlakyProvider(true);
    const router = new ModelRouter({ primary });
    const messages = [createDummyMessage('No fallback test')];

    await assert.rejects(
      async () => router.generateResponse(messages, 'System instructions'),
      (err: Error) => err.message.includes('rate limited or down')
    );
  });

  it('correctly handles stream failover to fallback provider', async () => {
    const primary = new FlakyProvider(true);
    const fallback = new DeterministicProvider({
      modelName: 'fallback-stream',
      defaultResponse: 'Streaming fallback test words',
    });

    const router = new ModelRouter({ primary, fallback, timeoutMs: 1000 });
    const messages = [createDummyMessage('Stream me')];

    const chunks: string[] = [];
    let sawFallback = false;

    for await (const item of router.streamResponse(messages, 'System instructions')) {
      chunks.push(item.chunk);
      if (item.fallbackUsed) sawFallback = true;
    }

    assert.ok(chunks.length > 0);
    assert.equal(chunks.join(''), 'Streaming fallback test words');
    assert.equal(sawFallback, true);
  });
});
