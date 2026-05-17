import React from "react";

import { LoginPageClient } from "@/components/auth/login-page-client";
import { redirectAuthenticatedVisitor } from "@/server/services/auth/auth-page-guard";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  await redirectAuthenticatedVisitor(resolvedSearchParams?.next ?? "/interview");

  return <LoginPageClient nextPath={resolvedSearchParams?.next ?? null} />;
}
