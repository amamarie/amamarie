-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "eventHash" TEXT,
ADD COLUMN     "hashAlgorithm" TEXT NOT NULL DEFAULT 'sha256',
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "previousHash" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "sensitivityLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'system';

-- CreateIndex
CREATE INDEX "AuditLog_source_idx" ON "AuditLog"("source");

-- CreateIndex
CREATE INDEX "AuditLog_sensitivityLevel_idx" ON "AuditLog"("sensitivityLevel");

-- CreateIndex
CREATE INDEX "AuditLog_eventHash_idx" ON "AuditLog"("eventHash");
