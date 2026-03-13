-- DropForeignKey
ALTER TABLE "Concept" DROP CONSTRAINT "Concept_courseId_fkey";

-- DropForeignKey
ALTER TABLE "ConceptOutcome" DROP CONSTRAINT "ConceptOutcome_conceptId_fkey";

-- DropForeignKey
ALTER TABLE "ConceptOutcome" DROP CONSTRAINT "ConceptOutcome_outcomeId_fkey";

-- DropForeignKey
ALTER TABLE "CourseMaterial" DROP CONSTRAINT "CourseMaterial_courseId_fkey";

-- DropForeignKey
ALTER TABLE "CourseMaterialModule" DROP CONSTRAINT "CourseMaterialModule_materialId_fkey";

-- DropForeignKey
ALTER TABLE "CourseMaterialModule" DROP CONSTRAINT "CourseMaterialModule_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "CourseModule" DROP CONSTRAINT "CourseModule_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_courseModuleId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseConcept" DROP CONSTRAINT "ExerciseConcept_conceptId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseConcept" DROP CONSTRAINT "ExerciseConcept_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "LearningObjective" DROP CONSTRAINT "LearningObjective_courseModuleId_fkey";

-- DropForeignKey
ALTER TABLE "LearningOutcome" DROP CONSTRAINT "LearningOutcome_courseModuleId_fkey";

-- DropForeignKey
ALTER TABLE "ModuleConcept" DROP CONSTRAINT "ModuleConcept_conceptId_fkey";

-- DropForeignKey
ALTER TABLE "ModuleConcept" DROP CONSTRAINT "ModuleConcept_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "OutcomeObjective" DROP CONSTRAINT "OutcomeObjective_objectiveId_fkey";

-- DropForeignKey
ALTER TABLE "OutcomeObjective" DROP CONSTRAINT "OutcomeObjective_outcomeId_fkey";

-- DropForeignKey
ALTER TABLE "TheoryBlock" DROP CONSTRAINT "TheoryBlock_conceptId_fkey";

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningObjective" ADD CONSTRAINT "LearningObjective_courseModuleId_fkey" FOREIGN KEY ("courseModuleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_courseModuleId_fkey" FOREIGN KEY ("courseModuleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeObjective" ADD CONSTRAINT "OutcomeObjective_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "LearningOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeObjective" ADD CONSTRAINT "OutcomeObjective_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "LearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptOutcome" ADD CONSTRAINT "ConceptOutcome_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptOutcome" ADD CONSTRAINT "ConceptOutcome_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "LearningOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleConcept" ADD CONSTRAINT "ModuleConcept_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleConcept" ADD CONSTRAINT "ModuleConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryBlock" ADD CONSTRAINT "TheoryBlock_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_courseModuleId_fkey" FOREIGN KEY ("courseModuleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseConcept" ADD CONSTRAINT "ExerciseConcept_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseConcept" ADD CONSTRAINT "ExerciseConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterialModule" ADD CONSTRAINT "CourseMaterialModule_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterialModule" ADD CONSTRAINT "CourseMaterialModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
