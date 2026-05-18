CREATE TABLE "AvailabilityException" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startMinutes" INTEGER,
  "endMinutes" INTEGER,
  "type" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "reason" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "createdById" TEXT,
  "clientId" TEXT,
  "leadId" TEXT,
  "taskId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL DEFAULT 'MEETING',
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
  "locationType" TEXT NOT NULL DEFAULT 'VIDEO',
  "meetingUrl" TEXT,
  "source" TEXT NOT NULL DEFAULT 'INTERNAL',
  "externalEventId" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'DETAILS',
  "questionnaireAnswers" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingType" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "advisorId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "durationMinutes" INTEGER NOT NULL DEFAULT 45,
  "slotStepMinutes" INTEGER NOT NULL DEFAULT 30,
  "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
  "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 15,
  "minimumNoticeHours" INTEGER NOT NULL DEFAULT 24,
  "maxBookingsPerDay" INTEGER NOT NULL DEFAULT 6,
  "locationType" TEXT NOT NULL DEFAULT 'VIDEO',
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "questionnaire" JSONB,
  "createsOpportunity" BOOLEAN NOT NULL DEFAULT false,
  "campaignKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "meetingTypeId" TEXT,
  "clientId" TEXT,
  "leadId" TEXT,
  "taskId" TEXT,
  "calendarEventId" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  "clientName" TEXT NOT NULL,
  "clientEmail" TEXT NOT NULL,
  "clientPhone" TEXT,
  "message" TEXT,
  "source" TEXT NOT NULL DEFAULT 'PUBLIC_BOOKING',
  "cancellationToken" TEXT,
  "rescheduleToken" TEXT,
  "questionnaireAnswers" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingHold" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "meetingTypeId" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "clientEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingHold_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarPermission" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "viewerUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "permissionLevel" TEXT NOT NULL DEFAULT 'FREE_BUSY_ONLY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalCalendarConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountEmail" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Booking_cancellationToken_key" ON "Booking"("cancellationToken");
CREATE UNIQUE INDEX "Booking_rescheduleToken_key" ON "Booking"("rescheduleToken");
CREATE UNIQUE INDEX "CalendarPermission_organizationId_viewerUserId_targetUserId_key" ON "CalendarPermission"("organizationId", "viewerUserId", "targetUserId");

CREATE INDEX "AvailabilityException_organizationId_idx" ON "AvailabilityException"("organizationId");
CREATE INDEX "AvailabilityException_advisorId_idx" ON "AvailabilityException"("advisorId");
CREATE INDEX "AvailabilityException_date_idx" ON "AvailabilityException"("date");
CREATE INDEX "CalendarEvent_organizationId_idx" ON "CalendarEvent"("organizationId");
CREATE INDEX "CalendarEvent_advisorId_idx" ON "CalendarEvent"("advisorId");
CREATE INDEX "CalendarEvent_clientId_idx" ON "CalendarEvent"("clientId");
CREATE INDEX "CalendarEvent_leadId_idx" ON "CalendarEvent"("leadId");
CREATE INDEX "CalendarEvent_taskId_idx" ON "CalendarEvent"("taskId");
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");
CREATE INDEX "CalendarEvent_endAt_idx" ON "CalendarEvent"("endAt");
CREATE INDEX "CalendarEvent_status_idx" ON "CalendarEvent"("status");
CREATE INDEX "MeetingType_organizationId_idx" ON "MeetingType"("organizationId");
CREATE INDEX "MeetingType_advisorId_idx" ON "MeetingType"("advisorId");
CREATE INDEX "MeetingType_isPublic_idx" ON "MeetingType"("isPublic");
CREATE INDEX "Booking_organizationId_idx" ON "Booking"("organizationId");
CREATE INDEX "Booking_advisorId_idx" ON "Booking"("advisorId");
CREATE INDEX "Booking_meetingTypeId_idx" ON "Booking"("meetingTypeId");
CREATE INDEX "Booking_startAt_idx" ON "Booking"("startAt");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_clientEmail_idx" ON "Booking"("clientEmail");
CREATE INDEX "BookingHold_organizationId_idx" ON "BookingHold"("organizationId");
CREATE INDEX "BookingHold_advisorId_idx" ON "BookingHold"("advisorId");
CREATE INDEX "BookingHold_meetingTypeId_idx" ON "BookingHold"("meetingTypeId");
CREATE INDEX "BookingHold_startAt_idx" ON "BookingHold"("startAt");
CREATE INDEX "BookingHold_expiresAt_idx" ON "BookingHold"("expiresAt");
CREATE INDEX "BookingHold_status_idx" ON "BookingHold"("status");
CREATE INDEX "CalendarPermission_organizationId_idx" ON "CalendarPermission"("organizationId");
CREATE INDEX "CalendarPermission_viewerUserId_idx" ON "CalendarPermission"("viewerUserId");
CREATE INDEX "CalendarPermission_targetUserId_idx" ON "CalendarPermission"("targetUserId");
CREATE INDEX "ExternalCalendarConnection_organizationId_idx" ON "ExternalCalendarConnection"("organizationId");
CREATE INDEX "ExternalCalendarConnection_userId_idx" ON "ExternalCalendarConnection"("userId");
CREATE INDEX "ExternalCalendarConnection_provider_idx" ON "ExternalCalendarConnection"("provider");
CREATE INDEX "ExternalCalendarConnection_status_idx" ON "ExternalCalendarConnection"("status");

ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingType" ADD CONSTRAINT "MeetingType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingType" ADD CONSTRAINT "MeetingType_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarPermission" ADD CONSTRAINT "CalendarPermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarPermission" ADD CONSTRAINT "CalendarPermission_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarPermission" ADD CONSTRAINT "CalendarPermission_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalCalendarConnection" ADD CONSTRAINT "ExternalCalendarConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalCalendarConnection" ADD CONSTRAINT "ExternalCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
