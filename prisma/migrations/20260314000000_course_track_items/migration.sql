-- CreateTable: треки курса (загружаемые админом: title, descriptionShort, mediaUrl)
CREATE TABLE "CourseTrackItem" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "descriptionShort" TEXT NOT NULL DEFAULT '',
    "mediaUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseTrackItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseTrackItem_courseId_sortOrder_idx" ON "CourseTrackItem"("courseId", "sortOrder");

ALTER TABLE "CourseTrackItem" ADD CONSTRAINT "CourseTrackItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing CourseTrack -> CourseTrackItem (copy from ContentTrack)
INSERT INTO "CourseTrackItem" ("id", "courseId", "title", "descriptionShort", "mediaUrl", "sortOrder", "createdAt")
SELECT
    gen_random_uuid()::text,
    ct."courseId",
    COALESCE(t."title", 'Трек'),
    COALESCE(t."descriptionShort", ''),
    COALESCE(t."audioUrl", '/uploads/tracks/placeholder.mp3'),
    ct."sortOrder",
    ct."createdAt"
FROM "CourseTrack" ct
JOIN "ContentTrack" t ON t."id" = ct."trackId";

-- Drop old CourseTrack
DROP TABLE "CourseTrack";
