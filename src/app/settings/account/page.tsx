import React from "react";

import { AccountSettingsClient } from "@/components/auth/account-settings-client";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

export default async function AccountSettingsPage() {
  const user = await requireAuthenticatedPage("/settings/account");

  return <AccountSettingsClient user={user} />;
}
