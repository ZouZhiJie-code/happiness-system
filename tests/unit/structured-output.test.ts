import { z } from "zod";

import { completeStructuredOutput, parseStructuredJson } from "@/server/services/ai/structured-output";
import type { AIProvider } from "@/server/services/ai/ai-provider";

const responseSchema = z.object({
  value: z.string()
});

function createProvider(responses: Array<string>): AIProvider {
  let index = 0;

  return {
    name: "mock-provider",
    async complete() {
      const content = responses[index] ?? responses[responses.length - 1] ?? '{"value":"fallback"}';
      index += 1;

      return {
        content,
        latencyMs: 12,
        provider: "mock-provider"
      };
    }
  };
}

describe("structured output", () => {
  it("parses json wrapped in markdown fences", () => {
    expect(parseStructuredJson('```json\n{"value":"ok"}\n```')).toEqual({
      value: "ok"
    });
  });

  it("retries once when the first payload is invalid", async () => {
    const attempts: string[] = [];
    const result = await completeStructuredOutput({
      provider: createProvider(['{"oops":true}', '{"value":"second"}']),
      stage: "extract",
      schema: responseSchema,
      messages: [],
      onAttempt: (attempt) => {
        attempts.push(`${attempt.provider}:${attempt.success}:${attempt.errorCode}`);
      }
    });

    expect(result).toEqual({ value: "second" });
    expect(attempts).toEqual(["mock-provider:false:INVALID_SCHEMA", "mock-provider:true:null"]);
  });

  it("returns null after two invalid attempts", async () => {
    const attempts: string[] = [];
    const result = await completeStructuredOutput({
      provider: createProvider(['{"oops":true}', '{"still":"bad"}']),
      stage: "generate",
      schema: responseSchema,
      messages: [],
      onAttempt: (attempt) => {
        attempts.push(`${attempt.provider}:${attempt.success}:${attempt.errorCode}`);
      }
    });

    expect(result).toBeNull();
    expect(attempts).toEqual(["mock-provider:false:INVALID_SCHEMA", "mock-provider:false:INVALID_SCHEMA"]);
  });
});
