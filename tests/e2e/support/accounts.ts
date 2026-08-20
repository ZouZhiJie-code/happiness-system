export type E2ETestAccount = {
  username: string;
  password: string;
};

const password = "DailyLight-E2E-2026";

export const E2E_ACCOUNTS = {
  auth: { username: "e2e_auth", password },
  capture: { username: "e2e_capture", password },
  chat: { username: "e2e_chat", password },
  recovery: { username: "e2e_recovery", password },
  idempotency: { username: "e2e_idempotency", password },
  journal: { username: "e2e_journal", password },
  boundary: { username: "e2e_boundary", password },
  admin: { username: "acceptance_admin", password },
  viewport1440: { username: "e2e_view_1440", password },
  viewport1024: { username: "e2e_view_1024", password }
} satisfies Record<string, E2ETestAccount>;
