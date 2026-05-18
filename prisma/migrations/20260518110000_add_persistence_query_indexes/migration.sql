CREATE INDEX "InterviewSession_userId_entryDate_idx"
ON "InterviewSession"("userId", "entryDate");

CREATE INDEX "JoyEntry_userId_date_idx"
ON "JoyEntry"("userId", "date");

CREATE INDEX "JoyEntry_userId_status_date_idx"
ON "JoyEntry"("userId", "status", "date");

CREATE INDEX "DailyJournalEntry_userId_date_idx"
ON "DailyJournalEntry"("userId", "date");

CREATE INDEX "DailyHappinessScore_userId_date_idx"
ON "DailyHappinessScore"("userId", "date");
