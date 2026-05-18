-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedValue" DOUBLE PRECISION,
ADD COLUMN     "previousStatus" "LeadStatus";
