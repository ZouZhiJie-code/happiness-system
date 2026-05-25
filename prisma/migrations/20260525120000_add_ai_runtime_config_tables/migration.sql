CREATE TYPE "AIRuntimeCapability" AS ENUM ('chat', 'embedding');

CREATE TYPE "AIRuntimeProvider" AS ENUM ('openai', 'anthropic', 'volcengine_ark');

CREATE TYPE "AIRuntimeConfigStatus" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "AIRuntimeConfig" (
    "id" TEXT NOT NULL,
    "capability" "AIRuntimeCapability" NOT NULL,
    "provider" "AIRuntimeProvider" NOT NULL,
    "status" "AIRuntimeConfigStatus" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT NOT NULL,
    "apiKeyCiphertext" TEXT,
    "apiKeyMask" TEXT,
    "configJson" JSONB NOT NULL,
    "configChecksum" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "rollbackFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRuntimeConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIRuntimeProbe" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "capability" "AIRuntimeCapability" NOT NULL,
    "provider" "AIRuntimeProvider" NOT NULL,
    "configChecksum" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "latencyMs" INTEGER,
    "summary" TEXT NOT NULL,
    "testedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRuntimeProbe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIRuntimeConfig_capability_version_key" ON "AIRuntimeConfig"("capability", "version");

CREATE INDEX "AIRuntimeConfig_capability_status_updatedAt_idx" ON "AIRuntimeConfig"("capability", "status", "updatedAt");

CREATE INDEX "AIRuntimeConfig_status_publishedAt_idx" ON "AIRuntimeConfig"("status", "publishedAt");

CREATE INDEX "AIRuntimeProbe_configId_createdAt_idx" ON "AIRuntimeProbe"("configId", "createdAt");

CREATE INDEX "AIRuntimeProbe_capability_createdAt_idx" ON "AIRuntimeProbe"("capability", "createdAt");

ALTER TABLE "AIRuntimeProbe"
ADD CONSTRAINT "AIRuntimeProbe_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AIRuntimeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
