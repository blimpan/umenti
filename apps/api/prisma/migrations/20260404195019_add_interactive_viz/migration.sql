-- AlterEnum
ALTER TYPE "ExerciseType" ADD VALUE 'INTERACTIVE';

-- AlterTable
ALTER TABLE "Concept" ADD COLUMN     "visualization" TEXT;

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "targetState" JSONB,
ADD COLUMN     "visualizationHtml" TEXT;
