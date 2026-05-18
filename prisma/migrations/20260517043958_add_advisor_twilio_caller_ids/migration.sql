-- CreateTable
CREATE TABLE "AdvisorTwilioCallerId" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "friendlyName" TEXT,
    "twilioCallerIdSid" TEXT,
    "validationCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorTwilioCallerId_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorTwilioCallerId_organizationId_idx" ON "AdvisorTwilioCallerId"("organizationId");

-- CreateIndex
CREATE INDEX "AdvisorTwilioCallerId_userId_idx" ON "AdvisorTwilioCallerId"("userId");

-- CreateIndex
CREATE INDEX "AdvisorTwilioCallerId_phoneNumber_idx" ON "AdvisorTwilioCallerId"("phoneNumber");

-- CreateIndex
CREATE INDEX "AdvisorTwilioCallerId_status_idx" ON "AdvisorTwilioCallerId"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorTwilioCallerId_organizationId_userId_phoneNumber_key" ON "AdvisorTwilioCallerId"("organizationId", "userId", "phoneNumber");

-- AddForeignKey
ALTER TABLE "AdvisorTwilioCallerId" ADD CONSTRAINT "AdvisorTwilioCallerId_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorTwilioCallerId" ADD CONSTRAINT "AdvisorTwilioCallerId_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
