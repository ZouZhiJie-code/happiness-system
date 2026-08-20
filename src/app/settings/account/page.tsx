import { redirect } from "next/navigation";

import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

export default async function AccountSettingsPage() {
  const user = await requireAuthenticatedPage("/settings/account");

  if (!user) {
    return null;
  }

  redirect("/settings#account");
  return null;
}
