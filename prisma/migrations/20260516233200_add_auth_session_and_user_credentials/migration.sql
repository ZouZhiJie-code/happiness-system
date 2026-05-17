-- Alter User model for account authentication
ALTER TABLE "User"
ADD COLUMN "username" TEXT,
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "agreedToTermsAt" TIMESTAMP(3),
ADD COLUMN "agreedToPrivacyAt" TIMESTAMP(3);

UPDATE "User"
SET
  "username" = CONCAT('legacy_user_', SUBSTRING("id" FROM 1 FOR 8)),
  "passwordHash" = 'legacy-account-disabled',
  "agreedToTermsAt" = NOW(),
  "agreedToPrivacyAt" = NOW()
WHERE "username" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "username" SET NOT NULL,
ALTER COLUMN "passwordHash" SET NOT NULL,
ALTER COLUMN "agreedToTermsAt" SET NOT NULL,
ALTER COLUMN "agreedToPrivacyAt" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "userAgent" TEXT,
  "ipAddress" TEXT,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
