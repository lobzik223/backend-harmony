-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex (optional: for filtering active users)
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
