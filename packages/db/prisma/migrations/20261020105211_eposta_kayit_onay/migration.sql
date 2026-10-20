-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "productNews" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "refId" TEXT NOT NULL DEFAULT '',
    "providerId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'productNews',
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_userId_sentAt_idx" ON "EmailLog"("userId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_userId_kind_refId_key" ON "EmailLog"("userId", "kind", "refId");

-- CreateIndex
CREATE INDEX "EmailConsent_userId_createdAt_idx" ON "EmailConsent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailConsent" ADD CONSTRAINT "EmailConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
