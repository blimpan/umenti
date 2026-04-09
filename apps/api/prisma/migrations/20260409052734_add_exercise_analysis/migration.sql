-- CreateTable
CREATE TABLE "ExerciseAnalysis" (
    "id" SERIAL NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "commonMisconceptions" JSONB NOT NULL,
    "attemptCountAtGeneration" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseAnalysis_exerciseId_key" ON "ExerciseAnalysis"("exerciseId");

-- CreateIndex
CREATE INDEX "ExerciseAnalysis_courseId_idx" ON "ExerciseAnalysis"("courseId");

-- AddForeignKey
ALTER TABLE "ExerciseAnalysis" ADD CONSTRAINT "ExerciseAnalysis_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAnalysis" ADD CONSTRAINT "ExerciseAnalysis_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
