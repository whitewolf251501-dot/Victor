import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import type { Message } from '@victor/shared';
import type { ModelProvider } from './provider.interface';

export class GeminiProviderError extends Error {
  public readonly code: string;
  public readonly originalError?: unknown;

  constructor(message: string, code: string = 'GEMINI_ERROR', originalError?: unknown) {
    // Ensure any sensitive key pattern is scrubbed from the error message
    const sanitized = GeminiProviderError.sanitizeMessage(message);
    super(sanitized);
    this.name = 'GeminiProviderError';
    this.code = code;
    this.originalError = originalError;
  }

  public static sanitizeMessage(raw: string): string {
    return raw.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
  }
}

export class GeminiProvider implements ModelProvider {
  private readonly modelName: string = 'gemini-1.5-pro';
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string) {
    this.assertServerEnvironment();
    const resolvedKey = apiKey ?? this.resolveApiKey();
    if (resolvedKey) {
      this.client = new GoogleGenerativeAI(resolvedKey);
    }
  }

  private assertServerEnvironment(): void {
    if (typeof window !== 'undefined') {
      throw new GeminiProviderError(
        'GeminiProvider must only be executed in a server-side environment to protect credentials.',
        'CLIENT_ENVIRONMENT_RESTRICTED'
      );
    }
  }

  private resolveApiKey(): string | null {
    if (typeof process === 'undefined' || !process.env) {
      return null;
    }
    return process.env.GEMINI_API_KEY ?? null;
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      const key = this.resolveApiKey();
      if (!key) {
        throw new GeminiProviderError(
          'GEMINI_API_KEY is not configured in the environment.',
          'MISSING_API_KEY'
        );
      }
      this.client = new GoogleGenerativeAI(key);
    }
    return this.client;
  }

  public getModelName(): string {
    return this.modelName;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      this.assertServerEnvironment();
      const key = this.resolveApiKey();
      return Boolean(key && key.trim().length > 0);
    } catch {
      return false;
    }
  }

  private formatMessages(messages: Message[]): Content[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
  }

  public async generateResponse(
    messages: Message[],
    systemPrompt: string
  ): Promise<string> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({
        model: this.modelName,
        systemInstruction: systemPrompt,
      });

      const contents = this.formatMessages(messages);
      const result = await model.generateContent({ contents });
      const response = await result.response;
      return response.text();
    } catch (error: unknown) {
      if (error instanceof GeminiProviderError) {
        throw error;
      }
      const rawMessage = error instanceof Error ? error.message : String(error);
      throw new GeminiProviderError(
        `Failed to generate response: ${rawMessage}`,
        'GENERATION_FAILED',
        error
      );
    }
  }

  public async *streamResponse(
    messages: Message[],
    systemPrompt: string
  ): AsyncGenerator<string> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({
        model: this.modelName,
        systemInstruction: systemPrompt,
      });

      const contents = this.formatMessages(messages);
      const result = await model.generateContentStream({ contents });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error: unknown) {
      if (error instanceof GeminiProviderError) {
        throw error;
      }
      const rawMessage = error instanceof Error ? error.message : String(error);
      throw new GeminiProviderError(
        `Streaming response failed: ${rawMessage}`,
        'STREAMING_FAILED',
        error
      );
    }
  }
}
