CREATE TABLE "AdvisorProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "publicSlug" TEXT NOT NULL,
  "publicName" TEXT NOT NULL,
  "publicDescription" TEXT,
  "avatarUrl" TEXT,
  "bookingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "defaultMeetingLocation" TEXT NOT NULL DEFAULT 'VIDEO',
  "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvisorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdvisorProfile_userId_key" ON "AdvisorProfile"("userId");
CREATE UNIQUE INDEX "AdvisorProfile_organizationId_publicSlug_key" ON "AdvisorProfile"("organizationId", "publicSlug");
CREATE UNIQUE INDEX "AdvisorProfile_publicSlug_key" ON "AdvisorProfile"("publicSlug");
CREATE INDEX "AdvisorProfile_organizationId_idx" ON "AdvisorProfile"("organizationId");
CREATE INDEX "AdvisorProfile_userId_idx" ON "AdvisorProfile"("userId");
CREATE INDEX "AdvisorProfile_bookingEnabled_idx" ON "AdvisorProfile"("bookingEnabled");

ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
