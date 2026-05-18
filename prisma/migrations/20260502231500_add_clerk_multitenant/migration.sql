-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "clerkOrganizationId" TEXT,
ADD COLUMN     "ownerClerkUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clerkUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_clerkOrganizationId_key" ON "Organization"("clerkOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
