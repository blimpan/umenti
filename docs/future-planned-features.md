## File overview
This file contains a list of features that we want to implement at some point but haven't yet.

## Features

- **Spaced repetition queue**
When too much time has passed since a student last proved comprehension of a concept, it is added to a review queue. Students work through queued concepts as part of weekly homework. Each concept tracks the last time comprehension was demonstrated.

- **AI grading assistant**
After a submission deadline, each student submission is converted to structured output and passed to an LLM along with the grading criteria. The AI generates teacher-style comments and a suggested grade with reasoning, which the teacher verifies and corrects before it is shown to the student.

- **Class-wide diagnostic analytics**
Teachers see aggregated data on which concepts the class struggled with most, derived from student interactions. Concepts where many students have repeatedly failed exercises are surfaced prominently so the teacher can target intervention.

- **Student concept comprehension tracker**
For each student, the platform tracks which concepts have been understood, which have not, and how much effort was spent on each. This data feeds both the spaced repetition system and the teacher's analytics dashboard.

- **Student profile and interest onboarding**
On first entry, students fill out a chat-style setup capturing their interests, age, and learning goals. This context is included in the AI tutor's prompt so explanations feel relevant and personalized.

- **Prior knowledge baseline assessment**
At the start of each module, students answer 3 diagnostic questions to establish their existing understanding. The AI adapts the theory presentation and exercise difficulty based on the result.

- **Points system**
Students earn different types of points for different learning behaviors: repetition points for spaced review, exploration points for going beyond the module scope, and feedback points for acting on returned assignments. Teachers incorporate these into their grading rubric.

- **Homework assignment builder**
Teachers create structured homework assignments that specify a point target across point types (e.g. 10 repetition points, 5 exploration points) by a due date. The platform tracks student progress toward the target.

- **Feedback action tasks**
When graded assignments are returned, students are assigned a follow-up task to implement the feedback they received. Completion is tracked and contributes to points.

- **Curriculum import from official sources**
Teachers can select a pre-structured course from their country's official curriculum (e.g. the Swedish National Agency of Education) instead of building from scratch. The platform pre-populates modules, learning objectives, and outcomes.

- **Knowledge base with source citation**
Uploaded teacher materials are indexed and tied to specific modules. The AI tutor retrieves relevant passages to ground its responses and cites the source, preventing hallucination.

- **Course invite and notification system**
Teachers invite students to a course via email. Students receive an in-platform notification and an email with a join link. The platform handles invite state (pending, accepted).

- **Module context introduction**
When a student enters a module for the first time, they are shown an explanation of what the module covers, how it connects to the previous and next modules, and why the content matters in a real-world context.

- **Concept-level exercise threads**
Each exercise has an attached thread where the student can ask clarifying questions. The AI tutor responds using Socratic questioning — it never gives the direct answer to the exercise being worked on.

- **AI content review step**
Before generating a full course, the teacher can trigger an AI review of the provided course details. The AI asks clarifying questions and flags any gaps before the intensive generation step begins.

- **Course draft and publish workflow**
Generated courses start in "Draft" status. The teacher reviews and iterates on theory and exercises module by module before publishing. Individual elements can be commented on and sent back to the AI for revision.
