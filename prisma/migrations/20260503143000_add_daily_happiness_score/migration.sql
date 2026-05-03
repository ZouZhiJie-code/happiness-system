CREATE TABLE "DailyHappinessScore" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "meaningScore" INTEGER NOT NULL,
  "healthScore" INTEGER NOT NULL,
  "virtueScore" INTEGER NOT NULL,
  "autonomyScore" INTEGER NOT NULL,
  "interestScore" INTEGER NOT NULL,
  "skillScore" INTEGER NOT NULL,
  "relationshipScore" INTEGER NOT NULL,
  "livingConditionScore" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyHappinessScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyHappinessScore_userId_date_key" ON "DailyHappinessScore"("userId", "date");

ALTER TABLE "DailyHappinessScore"
  ADD CONSTRAINT "DailyHappinessScore_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
