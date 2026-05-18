ALTER TABLE "Client" ADD COLUMN "spouseGender" TEXT;
ALTER TABLE "Client" ADD COLUMN "spouseDateOfBirth" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "children" JSONB;
