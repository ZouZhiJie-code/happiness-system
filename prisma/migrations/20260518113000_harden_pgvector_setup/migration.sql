CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "MemoryFact" ADD COLUMN IF NOT EXISTS "embedding" vector(2048);

-- pgvector ANN indexes are not deployable here because 2048 dimensions exceed
-- the current ivfflat / hnsw index limits. Keep the column provisioned so
-- memory retrieval can use sequential scan or application-level fallback.
