UPDATE "InterviewSession"
SET
  "status" = 'paused'::"InterviewSessionStatus",
  "pausedAt" = COALESCE("completedAt", NOW()),
  "completedAt" = NULL
WHERE "status" = 'completed'::"InterviewSessionStatus";
