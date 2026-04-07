-- AlterTable: add conceptType to Concept
ALTER TABLE "Concept" ADD COLUMN "conceptType" TEXT;

-- AlterTable: add visualizationType and visualizationParams to Exercise
ALTER TABLE "Exercise" ADD COLUMN "visualizationType" TEXT,
ADD COLUMN "visualizationParams" JSONB;

-- CreateTable: ConceptVisualization
CREATE TABLE "ConceptVisualization" (
    "id" SERIAL NOT NULL,
    "conceptId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "visualizationType" TEXT NOT NULL,
    "visualizationParams" JSONB NOT NULL,
    "visualization" TEXT,

    CONSTRAINT "ConceptVisualization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConceptVisualization_conceptId_idx" ON "ConceptVisualization"("conceptId");

-- AddForeignKey
ALTER TABLE "ConceptVisualization" ADD CONSTRAINT "ConceptVisualization_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
