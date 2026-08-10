-- Reliable event-centered controls are persisted as user turns so replay uses
-- the same action and parameters after refresh or provider failure.
ALTER TYPE "InterviewUserTurnAction" ADD VALUE 'select_current_event';
ALTER TYPE "InterviewUserTurnAction" ADD VALUE 'select_exploration_angle';
ALTER TYPE "InterviewUserTurnAction" ADD VALUE 'continue_exploration';
ALTER TYPE "InterviewUserTurnAction" ADD VALUE 'exit_event';

ALTER TABLE "InterviewUserTurn" ADD COLUMN "eventOperationData" JSONB;
