-- CreateTable
CREATE TABLE "CurriculumTemplate" (
    "id" SERIAL NOT NULL,
    "country" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,

    CONSTRAINT "CurriculumTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumTemplateModule" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CurriculumTemplateModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateObjective" (
    "id" SERIAL NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "TemplateObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateOutcome" (
    "id" SERIAL NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "TemplateOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurriculumTemplate_country_subject_idx" ON "CurriculumTemplate"("country", "subject");

-- AddForeignKey
ALTER TABLE "CurriculumTemplateModule" ADD CONSTRAINT "CurriculumTemplateModule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CurriculumTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateObjective" ADD CONSTRAINT "TemplateObjective_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CurriculumTemplateModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateOutcome" ADD CONSTRAINT "TemplateOutcome_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CurriculumTemplateModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
