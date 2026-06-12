"use client";

import { usePathname } from "next/navigation";

import {
  interviewLeaveConfirmMessage,
  touchStoredInterviewSessionId
} from "@/features/interview/dimensions";
import { useInterviewStore } from "@/stores/interview-store";

export function useInterviewLeaveGuard() {
  const pathname = usePathname();
  const { dimension, messages, sessionDimension, sessionEntryDate, sessionId, status } = useInterviewStore();
  const isInterviewPage = pathname === "/interview";
  const hasUserMessages = messages.some((message) => message.role === "user");
  const shouldProtectInterview = isInterviewPage && status === "active" && hasUserMessages;

  function confirmLeaveInterview() {
    if (!shouldProtectInterview) {
      return true;
    }

    const confirmed = window.confirm(interviewLeaveConfirmMessage);

    if (confirmed && sessionId) {
      touchStoredInterviewSessionId(sessionDimension ?? dimension, sessionId, sessionEntryDate, hasUserMessages);
    }

    return confirmed;
  }

  return {
    confirmLeaveInterview,
    shouldProtectInterview
  };
}
