-- Link insurance needs analyses to the CRM product/opportunity they support.
ALTER TABLE "InsuranceNeedsAnalysis"
  ADD COLUMN "opportunityId" TEXT;

ALTER TABLE "InsuranceNeedsAnalysis"
  ADD CONSTRAINT "InsuranceNeedsAnalysis_opportunityId_fkey"
  FOREIGN KEY ("opportunityId")
  REFERENCES "FinancialProduct"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "InsuranceNeedsAnalysis_opportunityId_idx"
  ON "InsuranceNeedsAnalysis"("opportunityId");
