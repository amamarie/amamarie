-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "totalInvestmentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalInsuranceCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAnnualPremium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMonthlyContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEstimatedCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialProductValueHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "valueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialProductValueHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_organizationId_idx" ON "PortfolioSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_clientId_idx" ON "PortfolioSnapshot"("clientId");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_snapshotDate_idx" ON "PortfolioSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "FinancialProductValueHistory_organizationId_idx" ON "FinancialProductValueHistory"("organizationId");

-- CreateIndex
CREATE INDEX "FinancialProductValueHistory_productId_idx" ON "FinancialProductValueHistory"("productId");

-- CreateIndex
CREATE INDEX "FinancialProductValueHistory_clientId_idx" ON "FinancialProductValueHistory"("clientId");

-- CreateIndex
CREATE INDEX "FinancialProductValueHistory_valueDate_idx" ON "FinancialProductValueHistory"("valueDate");

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProductValueHistory" ADD CONSTRAINT "FinancialProductValueHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinancialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProductValueHistory" ADD CONSTRAINT "FinancialProductValueHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
