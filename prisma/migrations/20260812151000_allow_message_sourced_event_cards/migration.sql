-- Capture-mode record cards can be grounded directly in the user's saved
-- messages before any structured fact extraction exists. The existing
-- sourceMessages check continues to require at least one durable source.
ALTER TABLE "JournalEventEntry"
DROP CONSTRAINT IF EXISTS "JournalEventEntry_sourceFacts_check";
