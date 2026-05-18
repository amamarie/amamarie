CREATE TABLE "InternalAuthCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "passwordSalt" TEXT NOT NULL,
  "passwordUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalAuthCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalAuthCredential_userId_key" ON "InternalAuthCredential"("userId");

ALTER TABLE "InternalAuthCredential" ADD CONSTRAINT "InternalAuthCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
