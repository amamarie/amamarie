UPDATE "Organization"
SET
  "subscriptionPlan" = 'CROISSANCE',
  "advisorSeatLimit" = CASE WHEN "advisorSeatLimit" = 3 THEN 2 ELSE "advisorSeatLimit" END
WHERE "subscriptionPlan" = 'PRO';

UPDATE "Organization"
SET "subscriptionPlan" = 'RESEAU'
WHERE "subscriptionPlan" = 'PREMIUM';
