export type AuthenticatedUser = {
  id: string;
  username: string;
};

export type AuthSessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date | null;
  userAgent: string | null;
  ipAddress: string | null;
};

