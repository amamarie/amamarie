-- CreateTable
CREATE TABLE "AdvisorVoiceAutomationSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "greetingMessage" TEXT NOT NULL DEFAULT 'Bonjour {{first_name}}, je suis l''assistant vocal du cabinet. Je vous appelle pour preparer votre echange avec {{advisor_name}}. Est-ce toujours un bon moment ?',
    "smsNotice" TEXT NOT NULL DEFAULT 'Bonjour {{first_name}}, merci pour votre demande. Notre assistant vocal vous appellera sous peu afin de preparer votre echange avec {{advisor_name}}.',
    "tone" TEXT NOT NULL DEFAULT 'professionnel_chaleureux',
    "language" TEXT NOT NULL DEFAULT 'fr-CA',
    "callDelayMinutes" INTEGER NOT NULL DEFAULT 5,
    "availabilityPreference" TEXT NOT NULL DEFAULT 'heures_ouvrables',
    "qualificationType" TEXT NOT NULL DEFAULT 'assurance_et_planification',
    "bookingLink" TEXT,
    "specialties" TEXT,
    "customInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorVoiceAutomationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorVoiceAutomationSettings_userId_key" ON "AdvisorVoiceAutomationSettings"("userId");

-- CreateIndex
CREATE INDEX "AdvisorVoiceAutomationSettings_organizationId_idx" ON "AdvisorVoiceAutomationSettings"("organizationId");

-- CreateIndex
CREATE INDEX "AdvisorVoiceAutomationSettings_userId_idx" ON "AdvisorVoiceAutomationSettings"("userId");

-- CreateIndex
CREATE INDEX "AdvisorVoiceAutomationSettings_isEnabled_idx" ON "AdvisorVoiceAutomationSettings"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorVoiceAutomationSettings_organizationId_userId_key" ON "AdvisorVoiceAutomationSettings"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "AdvisorVoiceAutomationSettings" ADD CONSTRAINT "AdvisorVoiceAutomationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorVoiceAutomationSettings" ADD CONSTRAINT "AdvisorVoiceAutomationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
