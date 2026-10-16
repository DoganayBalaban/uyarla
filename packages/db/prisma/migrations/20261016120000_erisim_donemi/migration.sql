-- CreateEnum
CREATE TYPE "AccessPassStatus" AS ENUM ('active', 'refunded');

-- CreateTable
CREATE TABLE "AccessPass" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "providerOrderId" TEXT NOT NULL,
    "status" "AccessPassStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessPass_providerOrderId_key" ON "AccessPass"("providerOrderId");

-- CreateIndex
CREATE INDEX "AccessPass_userId_endsAt_idx" ON "AccessPass"("userId", "endsAt");

-- AddForeignKey
ALTER TABLE "AccessPass" ADD CONSTRAINT "AccessPass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
