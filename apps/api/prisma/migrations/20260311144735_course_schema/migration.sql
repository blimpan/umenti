-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('GENERATING', 'DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('UNREVIEWED', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('MULTIPLE_CHOICE', 'FREE_TEXT');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('FILE', 'LINK');

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'GENERATING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseModule" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "whyThisModule" TEXT,
    "buildsOn" TEXT,
    "leadsInto" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',

    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningObjective" (
    "id" SERIAL NOT NULL,
    "courseModuleId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "LearningObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningOutcome" (
    "id" SERIAL NOT NULL,
    "courseModuleId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "LearningOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutcomeObjective" (
    "outcomeId" INTEGER NOT NULL,
    "objectiveId" INTEGER NOT NULL,

    CONSTRAINT "OutcomeObjective_pkey" PRIMARY KEY ("outcomeId","objectiveId")
);

-- CreateTable
CREATE TABLE "Concept" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptOutcome" (
    "conceptId" INTEGER NOT NULL,
    "outcomeId" INTEGER NOT NULL,

    CONSTRAINT "ConceptOutcome_pkey" PRIMARY KEY ("conceptId","outcomeId")
);

-- CreateTable
CREATE TABLE "ModuleConcept" (
    "moduleId" INTEGER NOT NULL,
    "conceptId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ModuleConcept_pkey" PRIMARY KEY ("moduleId","conceptId")
);

-- CreateTable
CREATE TABLE "TheoryBlock" (
    "id" SERIAL NOT NULL,
    "conceptId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "pendingRevision" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TheoryBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" SERIAL NOT NULL,
    "courseModuleId" INTEGER NOT NULL,
    "type" "ExerciseType" NOT NULL,
    "question" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "pendingRevision" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "correctIndex" INTEGER,
    "explanation" TEXT,
    "sampleAnswer" TEXT,
    "rubric" TEXT,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseConcept" (
    "exerciseId" INTEGER NOT NULL,
    "conceptId" INTEGER NOT NULL,

    CONSTRAINT "ExerciseConcept_pkey" PRIMARY KEY ("exerciseId","conceptId")
);

-- CreateTable
CREATE TABLE "CourseMaterial" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "type" "MaterialType" NOT NULL,
    "filename" TEXT,
    "storageKey" TEXT,
    "title" TEXT,
    "url" TEXT,

    CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMaterialModule" (
    "materialId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,

    CONSTRAINT "CourseMaterialModule_pkey" PRIMARY KEY ("materialId","moduleId")
);

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("supabaseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningObjective" ADD CONSTRAINT "LearningObjective_courseModuleId_fkey" FOREIGN KEY ("courseModuleId") REFERENCES "CourseModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_courseModuleId_fkey" FOREIGN KEY ("courseModuleId") REFERENCES "CourseModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeObjective" ADD CONSTRAINT "OutcomeObjective_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "LearningOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeObjective" ADD CONSTRAINT "OutcomeObjective_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "LearningObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptOutcome" ADD CONSTRAINT "ConceptOutcome_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptOutcome" ADD CONSTRAINT "ConceptOutcome_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "LearningOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleConcept" ADD CONSTRAINT "ModuleConcept_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleConcept" ADD CONSTRAINT "ModuleConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryBlock" ADD CONSTRAINT "TheoryBlock_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_courseModuleId_fkey" FOREIGN KEY ("courseModuleId") REFERENCES "CourseModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseConcept" ADD CONSTRAINT "ExerciseConcept_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseConcept" ADD CONSTRAINT "ExerciseConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterialModule" ADD CONSTRAINT "CourseMaterialModule_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterialModule" ADD CONSTRAINT "CourseMaterialModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
