ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PRODUCT_STATUS_CHANGED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PRODUCT_REVIEWED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PRODUCT_ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PRODUCT_DOCUMENT_LINKED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PRODUCT_TASK_CREATED';

DO $$ BEGIN
  CREATE TYPE "FinancialProductCategory" AS ENUM ('INSURANCE', 'INVESTMENT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialProductType" AS ENUM (
    'LIFE_INSURANCE',
    'DISABILITY_INSURANCE',
    'CRITICAL_ILLNESS',
    'HEALTH_INSURANCE',
    'GROUP_INSURANCE',
    'LONG_TERM_CARE',
    'TRAVEL_INSURANCE',
    'OTHER_INSURANCE',
    'RRSP',
    'TFSA',
    'RESP',
    'FHSA',
    'NON_REGISTERED',
    'INVESTMENT',
    'MUTUAL_FUND',
    'SEGREGATED_FUND',
    'GIC',
    'ANNUITY',
    'OTHER_INVESTMENT',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialProductStatus" AS ENUM (
    'ACTIVE',
    'PENDING',
    'UNDER_REVIEW',
    'LAPSED',
    'CANCELLED',
    'EXPIRED',
    'TRANSFERRED',
    'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentFrequency" AS ENUM (
    'WEEKLY',
    'BIWEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'SEMI_ANNUAL',
    'ANNUAL',
    'ONE_TIME',
    'IRREGULAR',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionType" AS ENUM ('FIRST_YEAR', 'RENEWAL', 'TRAILER', 'FLAT', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "FinancialProduct"
ADD COLUMN IF NOT EXISTS "advisorId" TEXT,
ADD COLUMN IF NOT EXISTS "category" "FinancialProductCategory",
ADD COLUMN IF NOT EXISTS "productName" TEXT,
ADD COLUMN IF NOT EXISTS "contractNumber" TEXT,
ADD COLUMN IF NOT EXISTS "accountNumber" TEXT,
ADD COLUMN IF NOT EXISTS "premiumFrequency" "PaymentFrequency",
ADD COLUMN IF NOT EXISTS "accountValue" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "contributionAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "contributionFrequency" "PaymentFrequency",
ADD COLUMN IF NOT EXISTS "commissionType" "CommissionType",
ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'CAD',
ADD COLUMN IF NOT EXISTS "primaryBeneficiary" TEXT,
ADD COLUMN IF NOT EXISTS "contingentBeneficiary" TEXT,
ADD COLUMN IF NOT EXISTS "beneficiaryNotes" TEXT,
ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "maturityAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cancellationAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastReviewAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextReviewAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "documentStatus" TEXT,
ADD COLUMN IF NOT EXISTS "missingDocuments" TEXT,
ADD COLUMN IF NOT EXISTS "complianceNotes" TEXT;

ALTER TABLE "FinancialProduct"
RENAME COLUMN "coverage" TO "coverageAmount";

ALTER TABLE "FinancialProduct"
RENAME COLUMN "commission" TO "commissionAmount";

ALTER TABLE "FinancialProduct"
ADD COLUMN IF NOT EXISTS "type_new" "FinancialProductType",
ADD COLUMN IF NOT EXISTS "status_new" "FinancialProductStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "FinancialProduct"
SET "type_new" = CASE
  WHEN "type"::text = 'LIFE_INSURANCE' THEN 'LIFE_INSURANCE'::"FinancialProductType"
  WHEN "type"::text = 'DISABILITY_INSURANCE' THEN 'DISABILITY_INSURANCE'::"FinancialProductType"
  WHEN "type"::text = 'CRITICAL_ILLNESS' THEN 'CRITICAL_ILLNESS'::"FinancialProductType"
  WHEN "type"::text = 'HEALTH_INSURANCE' THEN 'HEALTH_INSURANCE'::"FinancialProductType"
  WHEN "type"::text = 'RRSP' THEN 'RRSP'::"FinancialProductType"
  WHEN "type"::text = 'TFSA' THEN 'TFSA'::"FinancialProductType"
  WHEN "type"::text = 'INVESTMENT' THEN 'INVESTMENT'::"FinancialProductType"
  WHEN "type"::text = 'SEGREGATED_FUND' THEN 'SEGREGATED_FUND'::"FinancialProductType"
  WHEN "type"::text = 'ANNUITY' THEN 'ANNUITY'::"FinancialProductType"
  ELSE 'OTHER'::"FinancialProductType"
END
WHERE "type_new" IS NULL;

UPDATE "FinancialProduct"
SET "category" = CASE
  WHEN "type_new" IN (
    'LIFE_INSURANCE',
    'DISABILITY_INSURANCE',
    'CRITICAL_ILLNESS',
    'HEALTH_INSURANCE',
    'GROUP_INSURANCE',
    'LONG_TERM_CARE',
    'TRAVEL_INSURANCE',
    'OTHER_INSURANCE'
  ) THEN 'INSURANCE'::"FinancialProductCategory"
  WHEN "type_new" IN (
    'RRSP',
    'TFSA',
    'RESP',
    'FHSA',
    'NON_REGISTERED',
    'INVESTMENT',
    'MUTUAL_FUND',
    'SEGREGATED_FUND',
    'GIC',
    'ANNUITY',
    'OTHER_INVESTMENT'
  ) THEN 'INVESTMENT'::"FinancialProductCategory"
  ELSE 'OTHER'::"FinancialProductCategory"
END
WHERE "category" IS NULL;

UPDATE "FinancialProduct"
SET "status_new" = CASE
  WHEN upper("status") = 'PENDING' THEN 'PENDING'::"FinancialProductStatus"
  WHEN upper("status") = 'UNDER_REVIEW' THEN 'UNDER_REVIEW'::"FinancialProductStatus"
  WHEN upper("status") = 'LAPSED' THEN 'LAPSED'::"FinancialProductStatus"
  WHEN upper("status") = 'CANCELLED' THEN 'CANCELLED'::"FinancialProductStatus"
  WHEN upper("status") = 'EXPIRED' THEN 'EXPIRED'::"FinancialProductStatus"
  WHEN upper("status") = 'TRANSFERRED' THEN 'TRANSFERRED'::"FinancialProductStatus"
  WHEN upper("status") = 'ARCHIVED' THEN 'ARCHIVED'::"FinancialProductStatus"
  ELSE 'ACTIVE'::"FinancialProductStatus"
END;

ALTER TABLE "FinancialProduct" DROP COLUMN "type";
ALTER TABLE "FinancialProduct" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "FinancialProduct" ALTER COLUMN "type" SET NOT NULL;

ALTER TABLE "FinancialProduct" DROP COLUMN "status";
ALTER TABLE "FinancialProduct" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "FinancialProduct" ALTER COLUMN "category" SET NOT NULL;

ALTER TABLE "FinancialProduct"
ADD CONSTRAINT "FinancialProduct_advisorId_fkey"
FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "FinancialProduct_clientId_idx" ON "FinancialProduct"("clientId");
CREATE INDEX IF NOT EXISTS "FinancialProduct_status_idx" ON "FinancialProduct"("status");
CREATE INDEX IF NOT EXISTS "FinancialProduct_type_idx" ON "FinancialProduct"("type");
CREATE INDEX IF NOT EXISTS "FinancialProduct_renewalAt_idx" ON "FinancialProduct"("renewalAt");
CREATE INDEX IF NOT EXISTS "FinancialProduct_nextReviewAt_idx" ON "FinancialProduct"("nextReviewAt");
