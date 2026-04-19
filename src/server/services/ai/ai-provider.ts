export type AIMessageRole = "system" | "user" | "assistant";

export interface AIChatMessage {
  role: AIMessageRole;
  content: string;
}

export interface AICompletionParams {
  messages: AIChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResult {
  content: string;
  latencyMs: number;
  provider: string;
}

export interface AIProvider {
  readonly name: string;
  complete(params: AICompletionParams): Promise<AICompletionResult>;
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
