-- AlterTable
ALTER TABLE "Release" ADD COLUMN "releaseGroupMbid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Release_releaseGroupMbid_key" ON "Release"("releaseGroupMbid");
