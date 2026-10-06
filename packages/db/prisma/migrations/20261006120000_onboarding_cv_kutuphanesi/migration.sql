-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('career_change', 'first_job', 'promotion', 'exploring');

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "savedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "goal" "Goal",
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "targetRole" TEXT;
