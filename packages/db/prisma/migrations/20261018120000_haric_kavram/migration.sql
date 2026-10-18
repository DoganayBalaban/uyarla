-- CreateTable
CREATE TABLE "ExcludedConcept" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcludedConcept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExcludedConcept_userId_key_key" ON "ExcludedConcept"("userId", "key");

-- AddForeignKey
ALTER TABLE "ExcludedConcept" ADD CONSTRAINT "ExcludedConcept_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
