ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "subscriptionPricingMode" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS "subscriptionCurrency" TEXT NOT NULL DEFAULT 'EUR';
