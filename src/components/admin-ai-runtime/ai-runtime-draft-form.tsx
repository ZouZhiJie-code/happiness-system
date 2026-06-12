"use client";

import React from "react";

import { ActionButton, Card, Divider } from "@/components/ui";
import type { AIRuntimeCapability } from "@/features/admin-ai-runtime/types";
import type { AIRuntimeConfigPayload } from "@/features/admin-ai-runtime/api";

type DraftFormState = {
  provider: string;
  enabled: boolean;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  anthropicVersion: string;
  modelId: string;
  endpointId: string;
  embeddingEndpointId: string;
};

const FIELD_INPUT_CLASS =
  "min-h-11 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/70 px-4 text-ink outline-none transition-colors focus:border-[var(--line-strong)]";

function getProviderOptions(capability: AIRuntimeCapability) {
  return capability === "chat"
    ? [
        { value: "openai", label: "OpenAI" },
        { value: "anthropic", label: "Anthropic" },
        { value: "volcengine_ark", label: "Volcengine Ark" }
      ]
    : [
        { value: "openai", label: "OpenAI" },
        { value: "volcengine_ark", label: "Volcengine Ark" }
      ];
}

function getDefaultProvider(capability: AIRuntimeCapability) {
  return capability === "chat" ? "openai" : "volcengine_ark";
}

function getDefaultBaseUrl(provider: string) {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com";
    default:
      return "https://ark.cn-beijing.volces.com/api/v3";
  }
}

function createFormState(capability: AIRuntimeCapability, draft: AIRuntimeConfigPayload | null): DraftFormState {
  const provider = draft?.provider ?? getDefaultProvider(capability);
  const config = draft?.config ?? {};

  return {
    provider,
    enabled: draft?.enabled ?? true,
    displayName:
      draft?.displayName ??
      (capability === "chat" ? "聊天能力草稿" : "向量嵌入草稿"),
    apiKey: "",
    baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : getDefaultBaseUrl(provider),
    model: typeof config.model === "string" ? config.model : "",
    anthropicVersion: typeof config.anthropicVersion === "string" ? config.anthropicVersion : "2023-06-01",
    modelId: typeof config.modelId === "string" ? config.modelId : "",
    endpointId: typeof config.endpointId === "string" ? config.endpointId : "",
    embeddingEndpointId: typeof config.embeddingEndpointId === "string" ? config.embeddingEndpointId : ""
  };
}

function buildPayload(capability: AIRuntimeCapability, state: DraftFormState) {
  if (state.provider === "openai") {
    return {
      provider: "openai",
      enabled: state.enabled,
      displayName: state.displayName,
      ...(state.apiKey.trim() ? { apiKey: state.apiKey.trim() } : {}),
      config: {
        model: state.model.trim(),
        baseUrl: state.baseUrl.trim()
      }
    };
  }

  if (state.provider === "anthropic") {
    return {
      provider: "anthropic",
      enabled: state.enabled,
      displayName: state.displayName,
      ...(state.apiKey.trim() ? { apiKey: state.apiKey.trim() } : {}),
      config: {
        model: state.model.trim(),
        baseUrl: state.baseUrl.trim(),
        anthropicVersion: state.anthropicVersion.trim()
      }
    };
  }

  if (capability === "embedding") {
    return {
      provider: "volcengine_ark",
      enabled: state.enabled,
      displayName: state.displayName,
      ...(state.apiKey.trim() ? { apiKey: state.apiKey.trim() } : {}),
      config: {
        embeddingEndpointId: state.embeddingEndpointId.trim(),
        baseUrl: state.baseUrl.trim()
      }
    };
  }

  return {
    provider: "volcengine_ark",
    enabled: state.enabled,
    displayName: state.displayName,
    ...(state.apiKey.trim() ? { apiKey: state.apiKey.trim() } : {}),
    config: {
      ...(state.modelId.trim() ? { modelId: state.modelId.trim() } : {}),
      ...(state.endpointId.trim() ? { endpointId: state.endpointId.trim() } : {}),
      baseUrl: state.baseUrl.trim()
    }
  };
}

export function AIRuntimeDraftForm({
  capability,
  draft,
  pendingAction,
  onSave,
  onProbe,
  onPublish
}: {
  capability: AIRuntimeCapability;
  draft: AIRuntimeConfigPayload | null;
  pendingAction: "save" | "probe" | "publish" | null;
  onSave: (payload: Record<string, unknown>) => Promise<void> | void;
  onProbe: () => Promise<void> | void;
  onPublish: () => Promise<void> | void;
}) {
  const [formState, setFormState] = React.useState(() => createFormState(capability, draft));

  React.useEffect(() => {
    setFormState(createFormState(capability, draft));
  }, [capability, draft]);

  function updateField<Key extends keyof DraftFormState>(key: Key, value: DraftFormState[Key]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  return (
    <Card as="section" className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[var(--text-faint)]">草稿编辑区</p>
          <h3 className="mt-3 font-display text-2xl text-ink">
            {capability === "chat" ? "聊天能力草稿" : "向量嵌入草稿"}
          </h3>
        </div>
        <span className="wood-chip rounded-full px-4 py-2 text-xs tracking-[0.16em]">
          {draft ? `草稿 v${draft.version}` : "尚未保存"}
        </span>
      </div>

      <Divider className="mt-4" />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-[var(--text-dim)]">
          <span>草稿名称</span>
          <input
            value={formState.displayName}
            onChange={(event) => updateField("displayName", event.target.value)}
            className={FIELD_INPUT_CLASS}
          />
        </label>

        <label className="grid gap-2 text-sm text-[var(--text-dim)]">
          <span>Provider</span>
          <select
            value={formState.provider}
            onChange={(event) => {
              const nextProvider = event.target.value;
              setFormState((current) => ({
                ...current,
                provider: nextProvider,
                baseUrl: getDefaultBaseUrl(nextProvider)
              }));
            }}
            className={FIELD_INPUT_CLASS}
          >
            {getProviderOptions(capability).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-[var(--text-dim)] md:col-span-2">
          <span>API Key</span>
          <input
            type="password"
            value={formState.apiKey}
            onChange={(event) => updateField("apiKey", event.target.value)}
            placeholder={draft?.apiKeyMask ? `当前已保存：${draft.apiKeyMask}` : "输入新的 API Key"}
            className={FIELD_INPUT_CLASS}
          />
        </label>

        <label className="grid gap-2 text-sm text-[var(--text-dim)] md:col-span-2">
          <span>Base URL</span>
          <input
            value={formState.baseUrl}
            onChange={(event) => updateField("baseUrl", event.target.value)}
            className={FIELD_INPUT_CLASS}
          />
        </label>

        {formState.provider === "openai" ? (
          <label className="grid gap-2 text-sm text-[var(--text-dim)] md:col-span-2">
            <span>{capability === "chat" ? "聊天模型" : "Embedding 模型"}</span>
            <input
              value={formState.model}
              onChange={(event) => updateField("model", event.target.value)}
              className={FIELD_INPUT_CLASS}
            />
          </label>
        ) : null}

        {formState.provider === "anthropic" ? (
          <>
            <label className="grid gap-2 text-sm text-[var(--text-dim)]">
              <span>Messages 模型</span>
              <input
                value={formState.model}
                onChange={(event) => updateField("model", event.target.value)}
                className={FIELD_INPUT_CLASS}
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--text-dim)]">
              <span>Anthropic Version</span>
              <input
                value={formState.anthropicVersion}
                onChange={(event) => updateField("anthropicVersion", event.target.value)}
                className={FIELD_INPUT_CLASS}
              />
            </label>
          </>
        ) : null}

        {formState.provider === "volcengine_ark" && capability === "chat" ? (
          <>
            <label className="grid gap-2 text-sm text-[var(--text-dim)]">
              <span>模型 ID</span>
              <input
                value={formState.modelId}
                onChange={(event) => updateField("modelId", event.target.value)}
                className={FIELD_INPUT_CLASS}
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--text-dim)]">
              <span>Endpoint ID</span>
              <input
                value={formState.endpointId}
                onChange={(event) => updateField("endpointId", event.target.value)}
                className={FIELD_INPUT_CLASS}
              />
            </label>
          </>
        ) : null}

        {formState.provider === "volcengine_ark" && capability === "embedding" ? (
          <label className="grid gap-2 text-sm text-[var(--text-dim)] md:col-span-2">
            <span>Embedding Endpoint ID</span>
            <input
              value={formState.embeddingEndpointId}
              onChange={(event) => updateField("embeddingEndpointId", event.target.value)}
              className={FIELD_INPUT_CLASS}
            />
          </label>
        ) : null}
      </div>

      <label className="mt-4 inline-flex items-center gap-3 text-sm text-[var(--text-dim)]">
        <input
          type="checkbox"
          checked={formState.enabled}
          onChange={(event) => updateField("enabled", event.target.checked)}
        />
        <span>启用数据库配置接管运行时。关闭后会继续使用环境变量回退配置。</span>
      </label>

      <Divider className="mt-4" />

      <div className="mt-4 space-y-2 text-sm leading-7 text-[var(--text-dim)]">
        <p>发布后，从下一次 AI 请求开始生效</p>
        <p>保存后不会再次明文显示 API Key</p>
        <p>如果数据库配置不可用，系统会改用环境变量配置</p>
        <p>如果修改了草稿，必须重新执行连通性测试</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <ActionButton
          type="button"
          variant="primary"
          className="min-h-11 px-5 text-sm"
          onClick={() => void onSave(buildPayload(capability, formState))}
          disabled={pendingAction !== null}
        >
          {pendingAction === "save" ? "保存中…" : "保存草稿"}
        </ActionButton>
        <ActionButton
          type="button"
          variant="secondary"
          className="min-h-11 px-5 text-sm"
          onClick={() => void onProbe()}
          disabled={pendingAction !== null || !draft}
        >
          {pendingAction === "probe" ? "测试中…" : "执行连通性测试"}
        </ActionButton>
        <ActionButton
          type="button"
          variant="secondary"
          className="min-h-11 px-5 text-sm"
          onClick={() => void onPublish()}
          disabled={pendingAction !== null || !draft}
        >
          {pendingAction === "publish" ? "发布中…" : "发布配置"}
        </ActionButton>
      </div>
    </Card>
  );
}
