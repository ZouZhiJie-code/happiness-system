-- The event-centered workspace now permits up to two unfinished root records
-- per account, including two records on the same entry date. The repository
-- serializes creation on the user row and enforces that account-wide limit.
DROP INDEX IF EXISTS "InterviewSession_event_centered_active_root_key";
