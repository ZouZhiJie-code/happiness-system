"use client";

import React from "react";

import type { AIRuntimeStatusPayload } from "@/features/admin-ai-runtime/api";
import { formatAIRuntimeTimestamp } from "@/features/admin-ai-runtime/view-state";

function getCapabilityLabel(capability: AIRuntimeStatusPayload["capability"]) {
  return capability === "chat" ? "聊天能力" : "向量嵌入能力";
}

function getSourceLabel(source: AIRuntimeStatusPayload["source"]) {
  if (source === "database") {
    return "当前使用数据库配置";
  }

  if (source === "environment") {
    return "当前使用环境变量配置";
  }

  return "当前没有可用配置";
}

function getProviderLabel(provider: string) {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "volcengine_ark":
      return "Volcengine Ark";
    default:
      return provider;
  }
}

export function AIRuntimeStatusCard({ status }: { status: AIRuntimeStatusPayload }) {
  return (
    <section className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.44)] p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">{getCapabilityLabel(status.capability)}</p>
          <h2 className="mt-3 font-display text-2xl text-[#231d17]">{getSourceLabel(status.source)}</h2>
        </div>
        <span className="wood-chip rounded-full px-4 py-2 text-xs tracking-[0.16em]">
          {status.available ? "可用" : "待处理"}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm text-[#5a4632]">
        <div className="flex items-center justify-between gap-4">
          <dt>当前 provider</dt>
          <dd className="text-right text-[#2f2217]">{getProviderLabel(status.provider)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>模型或 endpoint</dt>
          <dd className="text-right text-[#2f2217]">{status.configSummary.modelOrEndpoint ?? "未配置"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Base URL</dt>
          <dd className="text-right text-[#2f2217]">{status.configSummary.baseUrl ?? "未配置"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>最近一次测试</dt>
          <dd className="text-right text-[#2f2217]">{status.latestProbe?.summary ?? "还没有测试记录"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>最近一次发布时间（北京时间）</dt>
          <dd className="text-right text-[#2f2217]">
            {formatAIRuntimeTimestamp(status.publishedConfig?.publishedAt ?? null) ?? "尚未发布"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>最近一次发布人</dt>
          <dd className="text-right text-[#2f2217]">{status.publishedConfig?.publishedBy ?? "尚未发布"}</dd>
        </div>
      </dl>

      {status.fallbackReason ? (
        <p className="mt-4 rounded-[18px] border border-[rgba(160,112,96,0.22)] bg-[rgba(255,245,241,0.84)] px-4 py-3 text-sm text-[#8a5440]">
          数据库配置当前没有接管运行时，系统正在使用环境变量回退配置。
        </p>
      ) : null}

      {!status.available ? (
        <p className="mt-4 rounded-[18px] border border-[rgba(160,112,96,0.22)] bg-[rgba(255,245,241,0.84)] px-4 py-3 text-sm text-[#8a5440]">
          当前错误码：{status.code}
        </p>
      ) : null}
    </section>
  );
}
