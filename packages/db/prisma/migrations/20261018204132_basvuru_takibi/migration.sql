-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "interviewAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "applicationReminders" BOOLEAN NOT NULL DEFAULT true;
