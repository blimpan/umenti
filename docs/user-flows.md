## File overview
This file contains general descriptions of typical user flows a teacher or student might have in the platform.
Note that this these lists are incomplete and just contain the ones we've mapped out so far. The file `docs/future-planned-features.md` and `docs/painpoints-and-features.md` might give hints of other user flows that aren't mentioned here.

## Typical user flows of a teacher

### Course creation
1. Teacher goes to dashboard page "My Courses".
2. Clicks on "Create New Course" button
3. Fills in form with the following information (but not necessarily in this order):
- Name. E.g. "9th Grade Mathematics"
- The target audience. E.g. kids age 14-15.
- Language. E.g. Swedish or English.
- Subject. E.g. "Mathematics"
- Modules the subject is broken down into. E.g. "algebra and geometry".
- Concepts each module should cover. E.g. "For algebra, mathematical equality and how the equals sign is used to representequations and functions, use of variables in algebraic expressions, formulas, equations andfunctions and methods for solving linear equations and simple quadratic equations". AI can help suggest concepts by the press of a button from the teacher.
- Learning objectives (the overall skill the teacher want to develop). E.g. "the ability to choose and use appropriate mathematical methods to perform calculations and solve routine tasks" and "the ability to use mathematical expressions to discuss and explainquestions, calculations and conclusions". AI can help suggest concepts by the press of a button from the teacher.
- Learning outcomes of each objective (the specific skills that the student will be taught in order to develop the overall skill). E.g. "Understanding real numbers and their properties, as well as their use in mathematical situations" and "Assessment of plausibility in estimations and calculations". AI can help suggest concepts by the press of a button from the teacher. 

NOTE: In almost all cases (if not all) this information can be taken from official state sources (e.g. the Swedish National Agency of Education) and structured in advance so that the teacher can just select their specific course within their country/state's curriculum.

4. (Optional) Uploads any existing learning material they want the LLM to use. For each resource uploaded, the module(s) it corresponds to needs to be selected.
5. Clicks "Evaluate" button to have AI do a quick review of the provided information and give it a chance to ask any clarifying questions before the teacher starts the more intensive job of generating the actual course.
6. Clicks "Generate course" button. Is shown a loading/thinking screen and a notification explaining that the course will appear under their "My Courses" page when it's ready.
7. When initial version of course has been generated, it is shown as having the status "Draft" in the list of courses.
8. Teacher enters newly generated course and reviews the base theory and exercises generated for each module. At any time they can leave a comment on an element from the theory or an exercise explaining how they want it changed and send it to the AI for it to update it according to the teacher's instructions or manually rewrite it if they want to.
9. Once satisfied, the teacher clicks the "Publish" button and is prompted to invite users using an email address if they haven't already done so in the course's settings page.

## Typical user flows of a student

## Entering the platform for the first time
1. User is presented with a page walking them through the setup of their account in a chatlike manner.
2. User is prompted to upload a profile picture (optional), specify their age (optional) and explain what their interests and potential future goals are (optional).

### Starting a new course
1. User gets invited to course using their email address. They either accept the invitation via their notifications in the platform or by clicking the "Join course" button in the email sent to them.
2. Upon entering the course for the first time they are presented with a walkthrough of what the course is about, how it is structured and why they should take it (e.g. you will be able to do this and that real-life thing with this knowledge).

## Starting a new module
1. Student clicks on a module for the first time and is presented with an explanation of what this module is about, how it builds upon the previous module (if applicable), how it ties into the next module (if applicable) and why they should learn it (e.g. concepts in it can be used in real-life for this and that).
2. They are presented with 3 basic questions to assess their prior knowledge.
3. Based on their established baseline they are presented with the first theory concept(s), tailored to them based on prior knowledge and personal facts (e.g. interested in football or movies).
4. To apply what they just read, they are given an exercise (shown an a dedicated component in the chatlike interface) based on that/those concept(s).
5. The student doesn't understand the question and asks a clarifying question in a thread attached to that question.
6. The AI tutor makes sure not to give a direct solution to the original exercise, but answers the question according to Socratic questioning principles.
7. The student gives an answer in the exercise's component and get's immediate feedback informing the user if they were correct/incorrect and how so. If this is enough for the student to be deemed as having understood the concept, the platform stores that and moves on to the next. The student is also given a number of points for proving their understanding of a concept.
8. The next concept is presented and so on...