-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('saved', 'applied', 'interview', 'offer', 'rejected');

-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "note" TEXT,
ADD COLUMN     "stage" "ApplicationStage" NOT NULL DEFAULT 'saved',
ADD COLUMN     "stageChangedAt" TIMESTAMP(3);
