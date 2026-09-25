-- CreateEnum
CREATE TYPE "AdaptationStatus" AS ENUM ('running', 'draft', 'ready', 'failed');

-- CreateTable
CREATE TABLE "Adaptation" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "resumeVersionId" TEXT,
    "status" "AdaptationStatus" NOT NULL DEFAULT 'running',
    "modelId" TEXT NOT NULL,
    "durationMs" INTEGER,
    "tokenUsage" INTEGER,
    "errorClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adaptation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Adaptation_analysisId_key" ON "Adaptation"("analysisId");

-- AddForeignKey
ALTER TABLE "Adaptation" ADD CONSTRAINT "Adaptation_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adaptation" ADD CONSTRAINT "Adaptation_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
