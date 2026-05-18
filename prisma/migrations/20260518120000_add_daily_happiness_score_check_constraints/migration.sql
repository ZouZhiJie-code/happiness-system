ALTER TABLE "DailyHappinessScore"
ADD CONSTRAINT "DailyHappinessScore_meaningScore_check" CHECK ("meaningScore" >= 1 AND "meaningScore" <= 10),
ADD CONSTRAINT "DailyHappinessScore_healthScore_check" CHECK ("healthScore" >= 1 AND "healthScore" <= 10),
ADD CONSTRAINT "DailyHappinessScore_virtueScore_check" CHECK ("virtueScore" >= 1 AND "virtueScore" <= 10),
ADD CONSTRAINT "DailyHappinessScore_autonomyScore_check" CHECK ("autonomyScore" >= 1 AND "autonomyScore" <= 10),
ADD CONSTRAINT "DailyHappinessScore_interestScore_check" CHECK ("interestScore" >= 1 AND "interestScore" <= 10),
ADD CONSTRAINT "DailyHappinessScore_skillScore_check" CHECK ("skillScore" >= 1 AND "skillScore" <= 10),
ADD CONSTRAINT "DailyHappinessScore_relationshipScore_check" CHECK ("relationshipScore" >= 1 AND "relationshipScore" <= 10),
ADD CONSTRAINT "DailyHappinessScore_livingConditionScore_check" CHECK ("livingConditionScore" >= 1 AND "livingConditionScore" <= 10);
