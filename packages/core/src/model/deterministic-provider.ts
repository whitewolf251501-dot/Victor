import type { Message } from '@victor/shared';
import type { ModelProvider } from './provider.interface';

export interface DeterministicProviderOptions {
  modelName?: string;
  defaultResponse?: string;
  cannedResponses?: Record<string, string>;
  responseDelayMs?: number;
}

export class DeterministicProvider implements ModelProvider {
  private readonly modelName: string;
  private readonly defaultResponse: string;
  private readonly cannedResponses: Record<string, string>;
  private readonly responseDelayMs: number;

  constructor(options: DeterministicProviderOptions = {}) {
    this.modelName = options.modelName ?? 'victor-deterministic-v1';
    this.defaultResponse = options.defaultResponse ?? 'Acknowledged. Standing by.';
    this.cannedResponses = options.cannedResponses ?? {};
    this.responseDelayMs = options.responseDelayMs ?? 0;
  }

  public getModelName(): string {
    return this.modelName;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  private resolveResponse(messages: Message[]): string {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() ?? '';
    for (const [key, canned] of Object.entries(this.cannedResponses)) {
      if (lastUserMessage.toLowerCase().includes(key.toLowerCase())) {
        return canned;
      }
    }
    return this.defaultResponse;
  }

  public async generateResponse(messages: Message[], _systemPrompt: string): Promise<string> {
    if (this.responseDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.responseDelayMs));
    }
    return this.resolveResponse(messages);
  }

  public async *streamResponse(messages: Message[], systemPrompt: string): AsyncGenerator<string> {
    const full = await this.generateResponse(messages, systemPrompt);
    const words = full.split(' ');
    for (let i = 0; i < words.length; i++) {
      const part = i === words.length - 1 ? words[i] : `${words[i]} `;
      yield part;
      if (this.responseDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(this.responseDelayMs, 20)));
      }
    }
  }
}
