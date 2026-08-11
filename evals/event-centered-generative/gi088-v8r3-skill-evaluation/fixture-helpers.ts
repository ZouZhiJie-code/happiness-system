import {
  GI088_V8R3_EVALUATION_DATASET_VERSION,
  gi088V8r3EvaluationCaseSchema,
  type Gi088V8r3EvaluationCase,
  type Gi088V8r3QuestionValueClassification
} from "./contracts";

type MessageSeed = readonly [role: "user" | "assistant", content: string];
type ForbiddenBehavior =
  Gi088V8r3EvaluationCase["checkpoints"][number]["forbiddenBehaviors"][number];
type Action =
  Gi088V8r3EvaluationCase["checkpoints"][number]["allowedActions"][number];

type CheckpointSeed = {
  userOrdinal: number;
  allowedActions: Action[];
  expectedValueClassification: Gi088V8r3QuestionValueClassification;
  evidenceUserOrdinals?: number[];
  forbiddenBehaviors: ForbiddenBehavior[];
};

type CaseSeed = {
  id: Gi088V8r3EvaluationCase["id"];
  partition: Gi088V8r3EvaluationCase["partition"];
  kind: Gi088V8r3EvaluationCase["kind"];
  source: Gi088V8r3EvaluationCase["source"];
  title: string;
  workingTask: string;
  messages: MessageSeed[];
  checkpoints: CheckpointSeed[];
};

export function defineGi088V8r3Case(seed: CaseSeed) {
  const prefix = seed.id.toLowerCase();
  const messages = seed.messages.map(([role, content], index) => ({
    id: `${prefix}-m${index + 1}`,
    role,
    content
  }));
  const userMessages = messages.filter((message) => message.role === "user");
  const checkpoints = seed.checkpoints.map((checkpoint) => {
    const afterUserMessage = userMessages[checkpoint.userOrdinal];
    if (!afterUserMessage) {
      throw new Error(`${seed.id} has no user message at ${checkpoint.userOrdinal}`);
    }
    const evidenceUserOrdinals = checkpoint.evidenceUserOrdinals ?? [
      checkpoint.userOrdinal
    ];
    return {
      afterUserMessageId: afterUserMessage.id,
      allowedActions: checkpoint.allowedActions,
      expectedValueClassification: checkpoint.expectedValueClassification,
      requiredEvidenceMessageIds: evidenceUserOrdinals.map((ordinal) => {
        const message = userMessages[ordinal];
        if (!message) {
          throw new Error(`${seed.id} has no evidence user message at ${ordinal}`);
        }
        return message.id;
      }),
      forbiddenBehaviors: checkpoint.forbiddenBehaviors
    };
  });
  return gi088V8r3EvaluationCaseSchema.parse({
    id: seed.id,
    datasetVersion: GI088_V8R3_EVALUATION_DATASET_VERSION,
    partition: seed.partition,
    kind: seed.kind,
    source: seed.source,
    title: seed.title,
    workingTask: seed.workingTask,
    messages,
    checkpoints
  });
}
