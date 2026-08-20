import { describe, expect, it } from "vitest";

import { createBoard7bWorkingTaskV1InitialSemanticState } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_INFORMATION_GAIN_VERSION,
  createGi088ResponseFirstInformationGainIdentity,
  getGi088ResponseFirstInformationGainAssets,
  validateGi088ResponseFirstInformationGainVisibleOutput
} from "../../evals/event-centered-generative/gi088-response-first-information-gain-v1/candidate";

const turnInput = {
  mode: "accompany_chat" as const,
  conversation: [
    { id: "A1", role: "assistant" as const, content: "你当时最直接的感受是什么？" },
    { id: "U1", role: "user" as const, content: "我有点生气，但也发现自己前面说接纳并不真实。" }
  ],
  latestUserMessageId: "U1",
  semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
};

describe("GI-088 response-first information-gain candidate", () => {
  it("只扩充可见 Skill，并绑定独立候选身份", () => {
    const assets = getGi088ResponseFirstInformationGainAssets();
    const identity = createGi088ResponseFirstInformationGainIdentity();

    expect(identity.version).toBe(GI088_RESPONSE_FIRST_INFORMATION_GAIN_VERSION);
    expect(identity.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(assets.visible.interviewSkill).toContain("新问题必须获得一项尚未出现");
    expect(assets.visible.interviewSkill).toContain("用户纠正后");
    expect(assets.visible.outputContract).toBe(
      assets.parent.visible.outputContract
    );
    expect(assets.structured).toEqual(assets.parent.structured);
  });

  it("程序拦截归一化后的逐字重复问句", () => {
    expect(
      validateGi088ResponseFirstInformationGainVisibleOutput({
        turnInput,
        output: {
          visible: {
            understanding: "你发现前面的接纳并不真实。",
            response: "我们继续。你当时最直接的感受是什么?"
          }
        }
      })
    ).toContain("VISIBLE_RESPONSE_REPEATS_PRIOR_QUESTION_EXACTLY");
  });

  it("允许同一主题下获得不同新材料的问题", () => {
    expect(
      validateGi088ResponseFirstInformationGainVisibleOutput({
        turnInput,
        output: {
          visible: {
            understanding: "你发现前面的接纳并不真实。",
            response: "这种假装接纳是在保护你不被什么感受淹没吗？"
          }
        }
      })
    ).not.toContain("VISIBLE_RESPONSE_REPEATS_PRIOR_QUESTION_EXACTLY");
  });
});
