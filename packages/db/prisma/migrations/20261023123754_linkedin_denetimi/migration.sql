-- CreateEnum
CREATE TYPE "LinkedInAuditSource" AS ENUM ('extension', 'pdf');

-- CreateEnum
CREATE TYPE "LinkedInAuditStatus" AS ENUM ('running', 'done', 'failed');

-- CreateTable
CREATE TABLE "LinkedInAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "LinkedInAuditSource" NOT NULL,
    "resumeId" TEXT,
    "profile" JSONB,
    "targetRole" TEXT,
    "analysisIds" TEXT[],
    "status" "LinkedInAuditStatus" NOT NULL DEFAULT 'running',
    "stage" TEXT,
    "report" JSONB,
    "rewrites" JSONB,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedInAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkedInAudit_userId_createdAt_idx" ON "LinkedInAudit"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "LinkedInAudit" ADD CONSTRAINT "LinkedInAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
