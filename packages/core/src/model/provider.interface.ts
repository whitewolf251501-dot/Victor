import type { Message } from '@victor/shared';

export interface ModelProvider {
  /**
   * Generates a complete response for the given conversation history and system prompt.
   */
  generateResponse(messages: Message[], systemPrompt: string): Promise<string>;

  /**
   * Streams token chunks for the given conversation history and system prompt.
   */
  streamResponse(messages: Message[], systemPrompt: string): AsyncGenerator<string>;

  /**
   * Verifies if the provider is currently available and configured properly.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Returns the canonical name of the model being served.
   */
  getModelName(): string;
}
