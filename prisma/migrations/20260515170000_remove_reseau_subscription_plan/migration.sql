UPDATE "Organization"
SET
  "subscriptionPlan" = 'CABINET',
  "organizationType" = CASE
    WHEN "organizationType" = 'RESEAU' THEN 'CABINET'
    ELSE "organizationType"
  END,
  "advisorSeatLimit" = GREATEST("advisorSeatLimit", 5)
WHERE "subscriptionPlan" = 'RESEAU';

UPDATE "Organization"
SET "organizationType" = 'CABINET'
WHERE "organizationType" = 'RESEAU';
