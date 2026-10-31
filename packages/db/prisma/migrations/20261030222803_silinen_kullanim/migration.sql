-- CreateTable
CREATE TABLE "DeletedUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletedUsage_userId_feature_usedAt_idx" ON "DeletedUsage"("userId", "feature", "usedAt");

-- AddForeignKey
ALTER TABLE "DeletedUsage" ADD CONSTRAINT "DeletedUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
