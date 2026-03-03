-- CreateTable: учёт прослушиваний треков пользователями
CREATE TABLE "TrackListen" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackListen_pkey" PRIMARY KEY ("id")
);

-- CreateTable: курсы (наборы треков для главной)
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "descriptionShort" TEXT NOT NULL DEFAULT '',
    "descriptionFull" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable: связь курса и треков
CREATE TABLE "CourseTrack" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackListen_trackId_userId_key" ON "TrackListen"("trackId", "userId");
CREATE INDEX "TrackListen_trackId_idx" ON "TrackListen"("trackId");
CREATE INDEX "TrackListen_userId_idx" ON "TrackListen"("userId");
CREATE INDEX "TrackListen_createdAt_idx" ON "TrackListen"("createdAt");

CREATE UNIQUE INDEX "CourseTrack_courseId_trackId_key" ON "CourseTrack"("courseId", "trackId");
CREATE INDEX "CourseTrack_courseId_sortOrder_idx" ON "CourseTrack"("courseId", "sortOrder");
CREATE INDEX "CourseTrack_trackId_idx" ON "CourseTrack"("trackId");

-- AddForeignKey
ALTER TABLE "TrackListen" ADD CONSTRAINT "TrackListen_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ContentTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackListen" ADD CONSTRAINT "TrackListen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseTrack" ADD CONSTRAINT "CourseTrack_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseTrack" ADD CONSTRAINT "CourseTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ContentTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
