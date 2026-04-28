ALTER TABLE "InterviewEvent"
ADD COLUMN "snapshotData" JSONB,
ADD COLUMN "progressData" JSONB;

ALTER TABLE "JoyEntry"
ADD COLUMN "payload" JSONB;

UPDATE "InterviewEvent" AS event
SET "snapshotData" = CASE session."dimension"::text
  WHEN 'joy' THEN jsonb_build_object(
    'kind', 'joy',
    'moment', event."event",
    'feeling', event."feeling",
    'joyType', event."happinessType",
    'meaningSource', event."whyItMattered",
    'selfPattern', event."selfPattern",
    'confidence', COALESCE(event."confidence", 0),
    'missingSlots', to_jsonb(event."missingSlots")
  )
  WHEN 'fulfillment' THEN jsonb_build_object(
    'kind', 'fulfillment',
    'experience', event."event",
    'feeling', event."feeling",
    'fulfillmentType', event."happinessType",
    'progressEvidence', event."whyItMattered",
    'valueSignal', event."selfPattern",
    'confidence', COALESCE(event."confidence", 0),
    'missingSlots', to_jsonb(event."missingSlots")
  )
  WHEN 'reflection' THEN jsonb_build_object(
    'kind', 'reflection',
    'trigger', event."event",
    'feeling', event."feeling",
    'reflectionType', event."happinessType",
    'insight', event."whyItMattered",
    'viewpointShift', event."selfPattern",
    'confidence', COALESCE(event."confidence", 0),
    'missingSlots', to_jsonb(event."missingSlots")
  )
  WHEN 'improvement' THEN jsonb_build_object(
    'kind', 'improvement',
    'situation', event."event",
    'feeling', event."feeling",
    'improvementType', event."happinessType",
    'frictionPoint', event."whyItMattered",
    'nextAttempt', event."selfPattern",
    'confidence', COALESCE(event."confidence", 0),
    'missingSlots', to_jsonb(event."missingSlots")
  )
  ELSE jsonb_build_object(
    'kind', 'gratitude',
    'moment', event."event",
    'feeling', event."feeling",
    'gratitudeType', event."happinessType",
    'gratitudeReason', event."whyItMattered",
    'relationshipSignal', event."selfPattern",
    'confidence', COALESCE(event."confidence", 0),
    'missingSlots', to_jsonb(event."missingSlots")
  )
END
FROM "InterviewSession" AS session
WHERE session."id" = event."sessionId";

UPDATE "JoyEntry" AS entry
SET "payload" = CASE session."dimension"::text
  WHEN 'joy' THEN jsonb_build_object(
    'kind', 'joy',
    'moment', entry."event",
    'feeling', entry."feeling",
    'joyType', entry."happinessType",
    'meaningSource', entry."whyItMattered",
    'selfPattern', entry."selfPattern",
    'tags', to_jsonb(entry."tags")
  )
  WHEN 'fulfillment' THEN jsonb_build_object(
    'kind', 'fulfillment',
    'experience', entry."event",
    'feeling', entry."feeling",
    'fulfillmentType', entry."happinessType",
    'progressEvidence', entry."whyItMattered",
    'valueSignal', entry."selfPattern",
    'tags', to_jsonb(entry."tags")
  )
  WHEN 'reflection' THEN jsonb_build_object(
    'kind', 'reflection',
    'trigger', entry."event",
    'feeling', entry."feeling",
    'reflectionType', entry."happinessType",
    'insight', entry."whyItMattered",
    'viewpointShift', entry."selfPattern",
    'tags', to_jsonb(entry."tags")
  )
  WHEN 'improvement' THEN jsonb_build_object(
    'kind', 'improvement',
    'situation', entry."event",
    'feeling', entry."feeling",
    'improvementType', entry."happinessType",
    'frictionPoint', entry."whyItMattered",
    'nextAttempt', entry."selfPattern",
    'tags', to_jsonb(entry."tags")
  )
  ELSE jsonb_build_object(
    'kind', 'gratitude',
    'moment', entry."event",
    'feeling', entry."feeling",
    'gratitudeType', entry."happinessType",
    'gratitudeReason', entry."whyItMattered",
    'relationshipSignal', entry."selfPattern",
    'tags', to_jsonb(entry."tags")
  )
END
FROM "InterviewSession" AS session
WHERE session."id" = entry."sessionId";
