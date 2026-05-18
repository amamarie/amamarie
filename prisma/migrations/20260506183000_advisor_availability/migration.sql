CREATE TABLE "AdvisorAvailabilitySlot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "advisorId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorAvailabilitySlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdvisorAvailabilitySlot_organizationId_advisorId_dayOfWeek_startMinutes_endMinutes_key" ON "AdvisorAvailabilitySlot"("organizationId", "advisorId", "dayOfWeek", "startMinutes", "endMinutes");
CREATE INDEX "AdvisorAvailabilitySlot_organizationId_idx" ON "AdvisorAvailabilitySlot"("organizationId");
CREATE INDEX "AdvisorAvailabilitySlot_advisorId_idx" ON "AdvisorAvailabilitySlot"("advisorId");
CREATE INDEX "AdvisorAvailabilitySlot_dayOfWeek_idx" ON "AdvisorAvailabilitySlot"("dayOfWeek");

ALTER TABLE "AdvisorAvailabilitySlot" ADD CONSTRAINT "AdvisorAvailabilitySlot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvisorAvailabilitySlot" ADD CONSTRAINT "AdvisorAvailabilitySlot_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
