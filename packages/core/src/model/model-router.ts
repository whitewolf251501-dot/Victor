import type { Message, ModelRoutingMetrics } from '@victor/shared';
import type { ModelProvider } from './provider.interface';

export interface ModelRouterConfig {
  primary: ModelProvider;
  fallback?: ModelProvider;
  timeoutMs?: number;
}

export interface RoutedResponse {
  content: string;
  metrics: ModelRoutingMetrics;
}

export class ModelRouterError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'ROUTER_ERROR') {
    super(message);
    this.name = 'ModelRouterError';
    this.code = code;
  }
}

export class ModelRouter {
  private readonly primary: ModelProvider;
  private readonly fallback?: ModelProvider;
  private readonly timeoutMs: number;

  constructor(config: ModelRouterConfig) {
    if (!config.primary) {
      throw new ModelRouterError('Primary model provider must be configured.', 'MISSING_PRIMARY');
    }
    this.primary = config.primary;
    this.fallback = config.fallback;
    this.timeoutMs = config.timeoutMs ?? 15000;
  }

  private async executeWithTimeout<T>(
    promiseFn: () => Promise<T>,
    timeoutMs: number,
    timeoutLabel: string
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new ModelRouterError(`Execution timed out after ${timeoutMs}ms [${timeoutLabel}]`, 'TIMEOUT'));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promiseFn(), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  public async generateResponse(messages: Message[], systemPrompt: string): Promise<RoutedResponse> {
    const startTime = Date.now();
    let primaryAvailable = false;

    try {
      primaryAvailable = await this.primary.isAvailable();
    } catch {
      primaryAvailable = false;
    }

    if (primaryAvailable) {
      try {
        const content = await this.executeWithTimeout(
          () => this.primary.generateResponse(messages, systemPrompt),
          this.timeoutMs,
          this.primary.getModelName()
        );
        const latencyMs = Date.now() - startTime;
        return {
          content,
          metrics: {
            provider: this.primary.constructor.name,
            model: this.primary.getModelName(),
            fallbackUsed: false,
            latencyMs,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (primaryErr) {
        if (!this.fallback) {
          throw primaryErr;
        }
        // Primary failed; proceed to fallback
      }
    }

    if (!this.fallback) {
      throw new ModelRouterError(
        `Primary provider ${this.primary.getModelName()} is unavailable and no fallback provider is configured.`,
        'PRIMARY_UNAVAILABLE'
      );
    }

    const fallbackAvailable = await this.fallback.isAvailable();
    if (!fallbackAvailable) {
      throw new ModelRouterError(
        `Fallback provider ${this.fallback.getModelName()} is unavailable.`,
        'FALLBACK_UNAVAILABLE'
      );
    }

    const fallbackContent = await this.executeWithTimeout(
      () => this.fallback!.generateResponse(messages, systemPrompt),
      this.timeoutMs,
      this.fallback.getModelName()
    );

    const latencyMs = Date.now() - startTime;
    return {
      content: fallbackContent,
      metrics: {
        provider: this.fallback.constructor.name,
        model: this.fallback.getModelName(),
        fallbackUsed: true,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
    };
  }

  public async *streamResponse(
    messages: Message[],
    systemPrompt: string
  ): AsyncGenerator<{ chunk: string; fallbackUsed: boolean }> {
    let primaryAvailable = false;
    try {
      primaryAvailable = await this.primary.isAvailable();
    } catch {
      primaryAvailable = false;
    }

    if (primaryAvailable) {
      try {
        for await (const chunk of this.primary.streamResponse(messages, systemPrompt)) {
          yield { chunk, fallbackUsed: false };
        }
        return;
      } catch {
        if (!this.fallback) {
          throw new ModelRouterError('Primary streaming failed and no fallback available.', 'STREAM_FAILED');
        }
      }
    }

    if (!this.fallback) {
      throw new ModelRouterError('No available provider for streaming.', 'NO_AVAILABLE_PROVIDER');
    }

    for await (const chunk of this.fallback.streamResponse(messages, systemPrompt)) {
      yield { chunk, fallbackUsed: true };
    }
  }
}
