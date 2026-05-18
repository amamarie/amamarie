ALTER TABLE "InternalAuthCredential"
ADD COLUMN "passwordResetTokenHash" TEXT,
ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN "passwordResetRequestedAt" TIMESTAMP(3),
ADD COLUMN "twoFactorChallengeHash" TEXT,
ADD COLUMN "twoFactorCodeHash" TEXT,
ADD COLUMN "twoFactorExpiresAt" TIMESTAMP(3),
ADD COLUMN "twoFactorRequestedAt" TIMESTAMP(3),
ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "lastTwoFactorAt" TIMESTAMP(3);

CREATE INDEX "InternalAuthCredential_passwordResetTokenHash_idx" ON "InternalAuthCredential"("passwordResetTokenHash");
CREATE INDEX "InternalAuthCredential_twoFactorChallengeHash_idx" ON "InternalAuthCredential"("twoFactorChallengeHash");
