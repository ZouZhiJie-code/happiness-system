CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "MemoryFact" ADD COLUMN IF NOT EXISTS "embedding" vector(2048);

CREATE INDEX IF NOT EXISTS "MemoryFact_embedding_cosine_idx" ON "MemoryFact" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- fallback for small datasets:
-- skip ivfflat creation during local bootstrap
