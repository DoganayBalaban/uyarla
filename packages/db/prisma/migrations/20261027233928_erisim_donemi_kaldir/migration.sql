-- DropForeignKey
ALTER TABLE "AccessPass" DROP CONSTRAINT "AccessPass_userId_fkey";

-- DropTable
DROP TABLE "AccessPass";

-- DropEnum
DROP TYPE "AccessPassStatus";

