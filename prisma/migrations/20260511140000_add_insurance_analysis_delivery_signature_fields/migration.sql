-- Add explicit versioning, delivery, and signature proof fields to insurance needs analyses.
ALTER TABLE "InsuranceNeedsAnalysis"
ADD COLUMN "analysisVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "signatureDocumentId" TEXT,
ADD COLUMN "signedAt" TIMESTAMP(3);

ALTER TABLE "InsuranceNeedsAnalysis"
ADD CONSTRAINT "InsuranceNeedsAnalysis_signatureDocumentId_fkey"
FOREIGN KEY ("signatureDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing analyses confirmed before these explicit fields existed.
UPDATE "InsuranceNeedsAnalysis"
SET
  "deliveredAt" = COALESCE("deliveredAt", "clientConfirmedAt"),
  "signedAt" = COALESCE("signedAt", "clientConfirmedAt"),
  "signatureDocumentId" = COALESCE("signatureDocumentId", "reportDocumentId")
WHERE "clientConfirmedAt" IS NOT NULL;

CREATE INDEX "InsuranceNeedsAnalysis_signatureDocumentId_idx" ON "InsuranceNeedsAnalysis"("signatureDocumentId");
CREATE INDEX "InsuranceNeedsAnalysis_analysisVersion_idx" ON "InsuranceNeedsAnalysis"("analysisVersion");
CREATE INDEX "InsuranceNeedsAnalysis_deliveredAt_idx" ON "InsuranceNeedsAnalysis"("deliveredAt");
CREATE INDEX "InsuranceNeedsAnalysis_signedAt_idx" ON "InsuranceNeedsAnalysis"("signedAt");
