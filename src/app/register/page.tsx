import React from "react";

import { RegisterPageClient } from "@/components/auth/register-page-client";
import { redirectAuthenticatedVisitor } from "@/server/services/auth/auth-page-guard";

type RegisterPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  await redirectAuthenticatedVisitor(resolvedSearchParams?.next ?? "/interview");

  return <RegisterPageClient nextPath={resolvedSearchParams?.next ?? null} />;
}
