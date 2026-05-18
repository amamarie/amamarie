-- Add organization ownership to financial products before enforcing the tenant boundary.
ALTER TABLE "FinancialProduct" ADD COLUMN "organizationId" TEXT;

UPDATE "FinancialProduct" AS product
SET "organizationId" = client."organizationId"
FROM "Client" AS client
WHERE product."clientId" = client."id";

ALTER TABLE "FinancialProduct" ALTER COLUMN "organizationId" SET NOT NULL;

-- Add explicit tenant foreign keys for every organization-scoped model.
ALTER TABLE "Document"
ADD CONSTRAINT "Document_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialProduct"
ADD CONSTRAINT "FinancialProduct_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallLog"
ADD CONSTRAINT "CallLog_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SMSMessage"
ADD CONSTRAINT "SMSMessage_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRule"
ADD CONSTRAINT "AutomationRule_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");
CREATE INDEX "FinancialProduct_organizationId_idx" ON "FinancialProduct"("organizationId");
CREATE INDEX "CallLog_organizationId_idx" ON "CallLog"("organizationId");
CREATE INDEX "SMSMessage_organizationId_idx" ON "SMSMessage"("organizationId");
CREATE INDEX "AutomationRule_organizationId_idx" ON "AutomationRule"("organizationId");
