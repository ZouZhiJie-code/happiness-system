"use client";

import { useLayoutEffect } from "react";

import { clearLocalAuthUserId, setLocalAuthUserId } from "@/features/auth/auth-local";

interface AuthLocalBootstrapProps {
  userId?: string | null;
}

export function AuthLocalBootstrap({ userId = null }: AuthLocalBootstrapProps) {
  useLayoutEffect(() => {
    if (userId) {
      setLocalAuthUserId(userId);
      return;
    }

    clearLocalAuthUserId();
  }, [userId]);

  return null;
}
