ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "organizationType" TEXT NOT NULL DEFAULT 'INDEPENDANT';

UPDATE "Organization"
SET "organizationType" = CASE
  WHEN "subscriptionPlan" = 'CROISSANCE' THEN 'CONSEILLER_ACTIF'
  WHEN "subscriptionPlan" = 'CABINET' THEN 'CABINET'
  WHEN "subscriptionPlan" = 'RESEAU' THEN 'RESEAU'
  ELSE 'INDEPENDANT'
END;
