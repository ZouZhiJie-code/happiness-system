import React from "react";

import { AccountSettingsClient } from "@/components/auth/account-settings-client";
import { SettingsAccountPanel } from "@/components/auth/settings-account-panel";
import { SettingsPageView } from "@/components/settings/settings-page-view";
import { isAdminUsername } from "@/server/services/auth/admin-access";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

export default async function SettingsPage() {
  const user = await requireAuthenticatedPage("/settings");

  if (!user) {
    return null;
  }

  const isAdmin = Boolean(user?.username && isAdminUsername(user.username));

  return (
    <SettingsPageView
      username={user.username}
      accountActions={<AccountSettingsClient user={user} />}
      internalTools={
        isAdmin ? (
          <SettingsAccountPanel
            user={user}
            showAdminAnalyticsEntry
            showAdminAIQualityEntry
            showAdminAIRuntimeEntry
          />
        ) : undefined
      }
    />
  );
}
