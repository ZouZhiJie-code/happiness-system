export type AIMessageRole = "system" | "user" | "assistant";

export interface AIChatMessage {
  role: AIMessageRole;
  content: string;
}

export interface AICompletionParams {
  messages: AIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AICompletionResult {
  content: string;
  latencyMs: number;
  provider: string;
}

export interface AIEmbeddingParams {
  input: string | string[];
}

export interface AIEmbeddingResult {
  embeddings: number[][];
  tokenCount?: number;
}

export interface AIProvider {
  readonly name: string;
  complete(params: AICompletionParams): Promise<AICompletionResult>;
  stream?(params: AICompletionParams): AsyncIterable<string>;
  embed?(params: AIEmbeddingParams): Promise<AIEmbeddingResult>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
