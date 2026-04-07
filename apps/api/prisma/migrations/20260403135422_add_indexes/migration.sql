-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "Concept_courseId_idx" ON "Concept"("courseId");

-- CreateIndex
CREATE INDEX "CourseModule_courseId_idx" ON "CourseModule"("courseId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE INDEX "Enrollment_email_idx" ON "Enrollment"("email");

-- CreateIndex
CREATE INDEX "Exercise_courseModuleId_idx" ON "Exercise"("courseModuleId");

-- CreateIndex
CREATE INDEX "LearningObjective_courseModuleId_idx" ON "LearningObjective"("courseModuleId");

-- CreateIndex
CREATE INDEX "LearningOutcome_courseModuleId_idx" ON "LearningOutcome"("courseModuleId");

-- CreateIndex
CREATE INDEX "TheoryBlock_conceptId_idx" ON "TheoryBlock"("conceptId");
