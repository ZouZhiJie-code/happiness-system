"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";

export function DataManagement() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "success" | "error">("idle");

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/settings/export");
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `happiness-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "确认清除所有历史数据？此操作不可撤销，将删除所有访谈记录、日志和记忆数据，但会保留你的账户和设置。"
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteStatus("idle");

    try {
      const res = await fetch("/api/settings/data", { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteStatus("success");
      setTimeout(() => setDeleteStatus("idle"), 3000);
    } catch (error) {
      console.error("Delete failed:", error);
      setDeleteStatus("error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 导出日志 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[#302114]">导出日志</h3>
        <p className="text-sm text-[#604529]">
          将你的所有幸福日志和每日日记导出为 JSON 文件，方便备份或迁移。
        </p>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#604529] px-4 py-1.5 text-sm text-[#f8fbff] transition-colors hover:bg-[#4a3520] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? "导出中" : "下载 JSON 文件"}
        </button>
      </div>

      {/* 清除历史数据 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[#302114]">清除历史数据</h3>
        <p className="text-sm text-[#604529]">
          删除所有访谈记录、日志条目和记忆数据。账户和偏好设置不受影响。此操作不可撤销。
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#7c5568] px-4 py-1.5 text-sm text-[#7c5568] transition-colors hover:bg-[rgba(124,85,104,0.08)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? "清除中" : "清除所有数据"}
          </button>
          {deleteStatus === "success" && (
            <span className="text-sm text-[#45644a]">已清除</span>
          )}
          {deleteStatus === "error" && (
            <span className="text-sm text-[#7c5568]">清除失败，请重试</span>
          )}
        </div>
      </div>

      {/* 数据存储说明 */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-medium text-[#302114]">数据存储说明</h3>
        <p className="text-sm leading-relaxed text-[#604529]">
          你的所有数据存储在本地 PostgreSQL 数据库中，不会上传至第三方服务器。访谈记录、幸福日志和记忆数据均保存在你自己的基础设施上。
        </p>
      </div>
    </div>
  );
}
