-- CreateEnum
CREATE TYPE "AttemptPhase" AS ENUM ('PRIOR_KNOWLEDGE', 'MAIN');

-- CreateTable
CREATE TABLE "ExerciseAttempt" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "phase" "AttemptPhase" NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "scoreChange" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseAttempt_userId_courseId_idx" ON "ExerciseAttempt"("userId", "courseId");

-- CreateIndex
CREATE INDEX "ExerciseAttempt_courseId_conceptId_idx" ON "ExerciseAttempt"("courseId", "conceptId");
