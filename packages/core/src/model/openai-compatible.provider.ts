import type { Message } from '@victor/shared';
import type { ModelProvider } from './provider.interface';

export interface OpenAICompatibleConfig {
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  temperature?: number;
}

export class OpenAICompatibleError extends Error {
  public readonly code: string;
  public readonly originalError?: unknown;

  constructor(message: string, code: string = 'OPENAI_COMPATIBLE_ERROR', originalError?: unknown) {
    const sanitized = OpenAICompatibleError.sanitizeMessage(message);
    super(sanitized);
    this.name = 'OpenAICompatibleError';
    this.code = code;
    this.originalError = originalError;
  }

  public static sanitizeMessage(raw: string): string {
    return raw
      .replace(/Bearer\s+[A-Za-z0-9_\-\.]{20,}/gi, 'Bearer [REDACTED_API_KEY]')
      .replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED_API_KEY]');
  }
}

export class OpenAICompatibleProvider implements ModelProvider {
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly apiKey: string | null;
  private readonly temperature: number;

  constructor(config: OpenAICompatibleConfig = {}) {
    this.assertServerEnvironment();
    this.baseUrl = (config.baseUrl ?? process.env?.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.modelName = config.modelName ?? process.env?.OPENAI_MODEL_NAME ?? 'gpt-4o-mini';
    this.apiKey = config.apiKey ?? process.env?.OPENAI_API_KEY ?? null;
    this.temperature = config.temperature ?? 0.7;
  }

  private assertServerEnvironment(): void {
    if (typeof window !== 'undefined') {
      throw new OpenAICompatibleError(
        'OpenAICompatibleProvider must only be executed in a server-side environment to protect credentials.',
        'CLIENT_ENVIRONMENT_RESTRICTED'
      );
    }
  }

  public getModelName(): string {
    return this.modelName;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      this.assertServerEnvironment();
      return Boolean(this.apiKey && this.apiKey.trim().length > 0);
    } catch {
      return false;
    }
  }

  private formatPayload(messages: Message[], systemPrompt: string, stream: boolean = false) {
    const formatted = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    return {
      model: this.modelName,
      messages: formatted,
      temperature: this.temperature,
      stream,
    };
  }

  public async generateResponse(messages: Message[], systemPrompt: string): Promise<string> {
    this.assertServerEnvironment();
    if (!this.apiKey) {
      throw new OpenAICompatibleError('API key is not configured for OpenAI-compatible provider.', 'MISSING_API_KEY');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(this.formatPayload(messages, systemPrompt, false)),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new OpenAICompatibleError(
          `Provider request failed with status ${response.status}: ${errorBody}`,
          `HTTP_${response.status}`
        );
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new OpenAICompatibleError('Malformed response: choices[0].message.content is missing', 'MALFORMED_RESPONSE');
      }

      return content;
    } catch (error: unknown) {
      if (error instanceof OpenAICompatibleError) {
        throw error;
      }
      const rawMessage = error instanceof Error ? error.message : String(error);
      throw new OpenAICompatibleError(`Failed to generate response: ${rawMessage}`, 'GENERATION_FAILED', error);
    }
  }

  public async *streamResponse(messages: Message[], systemPrompt: string): AsyncGenerator<string> {
    this.assertServerEnvironment();
    if (!this.apiKey) {
      throw new OpenAICompatibleError('API key is not configured for OpenAI-compatible provider.', 'MISSING_API_KEY');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(this.formatPayload(messages, systemPrompt, true)),
      });

      if (!response.ok || !response.body) {
        const errorBody = await response.text().catch(() => '');
        throw new OpenAICompatibleError(
          `Stream request failed with status ${response.status}: ${errorBody}`,
          `HTTP_${response.status}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') return;

          try {
            const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
            const chunk = parsed.choices?.[0]?.delta?.content;
            if (chunk) {
              yield chunk;
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof OpenAICompatibleError) {
        throw error;
      }
      const rawMessage = error instanceof Error ? error.message : String(error);
      throw new OpenAICompatibleError(`Streaming failed: ${rawMessage}`, 'STREAMING_FAILED', error);
    }
  }
}
