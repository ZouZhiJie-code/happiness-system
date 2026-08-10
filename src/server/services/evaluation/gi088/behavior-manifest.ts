import { createHash } from "node:crypto";

import generatedManifestJson from "@/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json";
import { GI088_BEHAVIOR_MANIFEST_VERSION } from "@/server/services/evaluation/gi088/version-manifest";

export type Gi088BehaviorLayer =
  | "candidate"
  | "dataset"
  | "runner"
  | "experience";

export type Gi088BehaviorFileSpec = {
  path: string;
  layers: readonly Gi088BehaviorLayer[];
};

export type Gi088BehaviorManifestEntry = {
  path: string;
  layers: Gi088BehaviorLayer[];
  sha256: string;
};

export type Gi088BehaviorManifest = {
  version: typeof GI088_BEHAVIOR_MANIFEST_VERSION;
  files: Gi088BehaviorManifestEntry[];
};

const ALL_LAYERS = [
  "candidate",
  "dataset",
  "runner",
  "experience"
] as const satisfies readonly Gi088BehaviorLayer[];

export const GI088_BEHAVIOR_FILE_SPECS = [
  {
    path: "evals/event-centered-generative/gi088-human-eval-v0/gi087-assets.snapshot.json",
    layers: ["candidate"]
  },
  {
    path: "evals/event-centered-generative/gi088-human-eval-v0/output-contract-clarification-v0.1.snapshot.json",
    layers: ["candidate"]
  },
  {
    path: "evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1.ts",
    layers: ["candidate", "runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/candidate.ts",
    layers: ["candidate", "dataset", "runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/question-decision.ts",
    layers: ["candidate"]
  },
  {
    path: "src/server/services/evaluation/gi088/stage-transition.ts",
    layers: ["candidate", "runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/single-focus.ts",
    layers: ["candidate", "runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/semantic-delta.ts",
    layers: ["candidate", "runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/version-manifest.ts",
    layers: ALL_LAYERS
  },
  {
    path: "src/server/services/evaluation/gi088/behavior-manifest.ts",
    layers: ALL_LAYERS
  },
  {
    path: "src/features/interview/intent/intent-v1.ts",
    layers: ["runner"]
  },
  {
    path: "src/features/interview/intent/control-decision-v2.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/interview/joy-interview.service.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/deterministic-state.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/single-question.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/service.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/store.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/prisma-store.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/foundation-store.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/foundation-prisma-store.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/foundation-memory-store.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/foundation-service.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/schema-diagnostics.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/pro-runtime.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/access.ts",
    layers: ["runner", "experience"]
  },
  {
    path: "src/server/services/ai/ai-provider.ts",
    layers: ["runner"]
  },
  {
    path: "src/server/services/ai/openai.provider.ts",
    layers: ["runner"]
  },
  {
    path: "prisma/evaluation/schema.prisma",
    layers: ["runner"]
  },
  {
    path: "prisma/evaluation/migrations/20260810180000_add_v8r2_foundation_hardening/migration.sql",
    layers: ["runner"]
  },
  {
    path: "src/server/services/evaluation/gi088/types.ts",
    layers: ["runner", "experience"]
  },
  {
    path: "src/server/services/evaluation/gi088/http.ts",
    layers: ["experience"]
  },
  {
    path: "src/server/services/evaluation/gi088/historical-export.ts",
    layers: ["experience"]
  },
  {
    path: "src/server/services/evaluation/gi088/technical-smoke.ts",
    layers: ["runner", "experience"]
  },
  {
    path: "src/server/services/evaluation/gi088/errors.ts",
    layers: ["experience"]
  },
  {
    path: "src/server/services/evaluation/gi088/metrics.ts",
    layers: ["experience"]
  },
  {
    path: "src/server/services/evaluation/gi088/export-v06.ts",
    layers: ["experience"]
  },
  {
    path: "src/features/interview/event-centered/gi088-evaluation-client.ts",
    layers: ["experience"]
  },
  {
    path: "src/features/interview/event-centered/gi088-evaluation-storage.ts",
    layers: ["experience"]
  },
  {
    path: "src/features/interview/event-centered/gi088-evaluation-sync.ts",
    layers: ["experience"]
  },
  {
    path: "src/features/interview/event-centered/gi088-evaluation-export.ts",
    layers: ["experience"]
  },
  {
    path: "src/components/interview/event-centered/gi088-evaluation-workbench.tsx",
    layers: ["experience"]
  },
  ...[
    "compare",
    "abort-current-task",
    "early-stop",
    "end-trajectory",
    "export",
    "operation-events",
    "program-intervention-review",
    "question-review",
    "retry",
    "runs",
    "seal",
    "session",
    "smoke",
    "start-task",
    "turn"
  ].map((route) => ({
    path: `src/app/api/preview/gi088/${route}/route.ts`,
    layers: ["experience"] as const
  })),
  { path: "next.config.ts", layers: ["experience"] },
  {
    path: "src/app/preview/gi088-evaluation/page.tsx",
    layers: ["experience"]
  },
  {
    path: "scripts/initialize-gi088-current-batch.ts",
    layers: ["runner"]
  },
  {
    path: "scripts/deploy-gi088-evaluation-schema.ts",
    layers: ["runner"]
  },
  {
    path: "scripts/check-gi088-behavior-manifest.ts",
    layers: ALL_LAYERS
  },
  { path: "package.json", layers: ALL_LAYERS },
  { path: "package-lock.json", layers: ALL_LAYERS }
] as const satisfies readonly Gi088BehaviorFileSpec[];

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafeRelativePath(path: string) {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").includes("..")
  ) {
    throw new Error(`GI088_BEHAVIOR_FILE_PATH_INVALID:${path}`);
  }
}

function normalizeLayers(layers: readonly Gi088BehaviorLayer[]) {
  const normalized = [...new Set(layers)].sort();
  if (normalized.length === 0) {
    throw new Error("GI088_BEHAVIOR_FILE_LAYERS_EMPTY");
  }
  return normalized;
}

function sortEntries(entries: readonly Gi088BehaviorManifestEntry[]) {
  return [...entries].sort((left, right) => left.path.localeCompare(right.path));
}

export function createGi088BehaviorManifest(input: {
  fileContents: Readonly<Record<string, string | Uint8Array | undefined>>;
  additionalFileSpecs?: readonly Gi088BehaviorFileSpec[];
}): Gi088BehaviorManifest {
  const specs = [
    ...GI088_BEHAVIOR_FILE_SPECS,
    ...(input.additionalFileSpecs ?? [])
  ];
  const seenPaths = new Set<string>();
  const entries = specs.map((spec) => {
    assertSafeRelativePath(spec.path);
    if (seenPaths.has(spec.path)) {
      throw new Error(`GI088_BEHAVIOR_FILE_DUPLICATE:${spec.path}`);
    }
    seenPaths.add(spec.path);
    const content = input.fileContents[spec.path];
    if (content === undefined) {
      throw new Error(`GI088_BEHAVIOR_FILE_MISSING:${spec.path}`);
    }
    return {
      path: spec.path,
      layers: normalizeLayers(spec.layers),
      sha256: sha256(content)
    };
  });
  return {
    version: GI088_BEHAVIOR_MANIFEST_VERSION,
    files: sortEntries(entries)
  };
}

export function parseGi088BehaviorManifest(
  input: unknown
): Gi088BehaviorManifest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("GI088_BEHAVIOR_MANIFEST_INVALID");
  }
  const source = input as { version?: unknown; files?: unknown };
  if (source.version !== GI088_BEHAVIOR_MANIFEST_VERSION) {
    throw new Error("GI088_BEHAVIOR_MANIFEST_VERSION_MISMATCH");
  }
  if (!Array.isArray(source.files)) {
    throw new Error("GI088_BEHAVIOR_MANIFEST_FILES_INVALID");
  }
  const seenPaths = new Set<string>();
  const entries = source.files.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("GI088_BEHAVIOR_MANIFEST_ENTRY_INVALID");
    }
    const entry = item as {
      path?: unknown;
      layers?: unknown;
      sha256?: unknown;
    };
    if (typeof entry.path !== "string") {
      throw new Error("GI088_BEHAVIOR_MANIFEST_PATH_INVALID");
    }
    assertSafeRelativePath(entry.path);
    if (seenPaths.has(entry.path)) {
      throw new Error(`GI088_BEHAVIOR_FILE_DUPLICATE:${entry.path}`);
    }
    seenPaths.add(entry.path);
    if (
      !Array.isArray(entry.layers) ||
      entry.layers.some((layer) => !ALL_LAYERS.includes(layer as Gi088BehaviorLayer))
    ) {
      throw new Error(`GI088_BEHAVIOR_FILE_LAYERS_INVALID:${entry.path}`);
    }
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(entry.sha256)) {
      throw new Error(`GI088_BEHAVIOR_FILE_SHA256_INVALID:${entry.path}`);
    }
    return {
      path: entry.path,
      layers: normalizeLayers(entry.layers as Gi088BehaviorLayer[]),
      sha256: entry.sha256
    };
  });
  return {
    version: GI088_BEHAVIOR_MANIFEST_VERSION,
    files: sortEntries(entries)
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function createGi088CanonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function createGi088BehaviorManifestSha256(
  manifest: Gi088BehaviorManifest
) {
  return sha256(createGi088CanonicalJson(manifest));
}

export function createGi088BehaviorLayerFingerprint(
  layer: Gi088BehaviorLayer,
  manifest: Gi088BehaviorManifest
) {
  const files = manifest.files
    .filter((entry) => entry.layers.includes(layer))
    .map(({ path, sha256: fileSha256 }) => ({ path, sha256: fileSha256 }));
  if (files.length === 0) {
    throw new Error(`GI088_BEHAVIOR_LAYER_EMPTY:${layer}`);
  }
  return sha256(
    createGi088CanonicalJson({
      behaviorManifestVersion: manifest.version,
      layer,
      files
    })
  );
}

export function verifyGi088BehaviorManifest(input: {
  expected: Gi088BehaviorManifest;
  actual: Gi088BehaviorManifest;
}) {
  const expectedByPath = new Map(
    input.expected.files.map((entry) => [entry.path, entry] as const)
  );
  const actualByPath = new Map(
    input.actual.files.map((entry) => [entry.path, entry] as const)
  );
  for (const [path, expected] of expectedByPath) {
    const actual = actualByPath.get(path);
    if (!actual) throw new Error(`GI088_BEHAVIOR_FILE_MISSING:${path}`);
    if (actual.sha256 !== expected.sha256) {
      throw new Error(`GI088_BEHAVIOR_FILE_SHA256_MISMATCH:${path}`);
    }
    if (actual.layers.join(",") !== expected.layers.join(",")) {
      throw new Error(`GI088_BEHAVIOR_FILE_LAYERS_MISMATCH:${path}`);
    }
  }
  for (const path of actualByPath.keys()) {
    if (!expectedByPath.has(path)) {
      throw new Error(`GI088_BEHAVIOR_FILE_UNDECLARED:${path}`);
    }
  }
  return {
    fileCount: input.expected.files.length,
    behaviorManifestSha256:
      createGi088BehaviorManifestSha256(input.expected),
    layerFingerprints: Object.fromEntries(
      ALL_LAYERS.map((layer) => [
        layer,
        createGi088BehaviorLayerFingerprint(layer, input.expected)
      ])
    ) as Record<Gi088BehaviorLayer, string>
  };
}

export const GI088_BEHAVIOR_MANIFEST = parseGi088BehaviorManifest(
  generatedManifestJson
);
