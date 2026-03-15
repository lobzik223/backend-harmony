-- AlterTable ContentSection: cardType (STATIC | TRACKS | VIDEO)
ALTER TABLE "ContentSection" ADD COLUMN "cardType" TEXT NOT NULL DEFAULT 'TRACKS';

-- AlterTable ContentTrack: videoUrl, mediaType
ALTER TABLE "ContentTrack" ADD COLUMN "videoUrl" TEXT;
ALTER TABLE "ContentTrack" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'AUDIO';

-- AlterTable Article: sectionId для секций cardType=STATIC
ALTER TABLE "Article" ADD COLUMN "sectionId" TEXT;

-- CreateIndex
CREATE INDEX "Article_sectionId_idx" ON "Article"("sectionId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ContentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
