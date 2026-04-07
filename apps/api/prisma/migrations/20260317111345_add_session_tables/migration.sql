-- CreateEnum
CREATE TYPE "ExerciseSource" AS ENUM ('TEACHER_PROVIDED', 'AI_PROVIDED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('AI', 'STUDENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'THEORY_BLOCK', 'EXERCISE_CARD', 'PRIOR_KNOWLEDGE_QUESTION', 'SYSTEM_MESSAGE', 'CONCEPT_MASTERY_REACHED', 'MODULE_END_REACHED');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "source" "ExerciseSource" NOT NULL DEFAULT 'TEACHER_PROVIDED';

-- CreateTable
CREATE TABLE "ModuleSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "type" "MessageType" NOT NULL,
    "payload" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleSession_userId_moduleId_key" ON "ModuleSession"("userId", "moduleId");

-- AddForeignKey
ALTER TABLE "ModuleSession" ADD CONSTRAINT "ModuleSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleSession" ADD CONSTRAINT "ModuleSession_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ModuleSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
