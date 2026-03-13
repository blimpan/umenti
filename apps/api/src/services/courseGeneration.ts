import { generateText, Output } from 'ai'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { getModel } from '../lib/llm'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Zod schemas — define the structured output the LLM must return
// ---------------------------------------------------------------------------

const Pass1Schema = z.object({
  modules: z.array(z.object({
    moduleId:     z.number(),
    whyThisModule: z.string(),
    buildsOn:     z.string(),
    leadsInto:    z.string(),
  }))
})

const Pass2Schema = z.object({
  concepts: z.array(z.object({
    name:         z.string(),
    theoryBlocks: z.array(z.string()),
  })),
  // Flat schema — avoids oneOf/anyOf which Anthropic structured output does not support.
  // type-specific fields are optional; the `type` enum drives which are populated.
  // Array constraints above minItems:1 are also unsupported, so we rely on the prompt
  // to instruct the LLM (e.g. "provide exactly 4 options").
  exercises: z.array(z.object({
    type:         z.enum(['multiple_choice', 'free_text']),
    conceptNames: z.array(z.string()),
    question:     z.string(),
    options:      z.array(z.string()).optional(),
    correctIndex: z.number().optional(),
    explanation:  z.string().optional(),
    sampleAnswer: z.string().optional(),
    rubric:       z.string().optional(),
  })),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FullCourse  = Awaited<ReturnType<typeof loadCourseData>>
type Pass1Output = z.infer<typeof Pass1Schema>
type Pass2Output = z.infer<typeof Pass2Schema>

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function triggerGeneration(courseId: number): Promise<void> {
  console.log(`[generation] Starting pipeline for course ${courseId}`)
  try {
    const course = await loadCourseData(courseId)
    await runPass1(course)
    await runPass2(course)
    await prisma.course.update({ where: { id: courseId }, data: { status: 'DRAFT' } })
    console.log(`[generation] Course ${courseId} complete`)
  } catch (err) {
    console.error(`[generation] Course ${courseId} failed:`, err)
    await prisma.course.update({ where: { id: courseId }, data: { status: 'FAILED' } }).catch(console.error)
  }
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadCourseData(courseId: number) {
  return prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      courseModules: {
        orderBy: { order: 'asc' },
        include: {
          objectives: true,
          outcomes:   true,
          materialLinks: { include: { material: true } },
        },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Pass 1 — course skeleton
// ---------------------------------------------------------------------------

async function runPass1(course: FullCourse): Promise<void> {
  console.log(`[generation] Pass 1 — skeleton for course ${course.id}`)

  const { output: pass1Result } = await generateText({
    model:  getModel(),
    output: Output.object({ schema: Pass1Schema }),
    prompt: buildPass1Prompt(course),
  })
  const pass1 = pass1Result as Pass1Output

  await Promise.all(
    pass1.modules.map(({ moduleId, whyThisModule, buildsOn, leadsInto }) =>
      prisma.courseModule.update({
        where: { id: moduleId },
        data:  { whyThisModule, buildsOn, leadsInto },
      })
    )
  )
}

function buildPass1Prompt(course: FullCourse): string {
  const modulesBlock = course.courseModules
    .map((module, index) => {
      const objectives = module.objectives.length
        ? module.objectives.map((o, i) => `    ${i + 1}. ${o.text}`).join('\n')
        : '    - none provided'

      const outcomes = module.outcomes.length
        ? module.outcomes.map((o, i) => `    ${i + 1}. ${o.text}`).join('\n')
        : '    - none provided'

      return [
        `Module ${index + 1}`,
        `  moduleId: ${module.id}`,
        `  name: ${module.name}`,
        '  objectives:',
        objectives,
        '  outcomes:',
        outcomes,
      ].join('\n')
    })
    .join('\n\n')
  
    /* Example of a modulesBlock:
Module 1
  moduleId: 123
  name: Introduction to Photosynthesis
  objectives:
    1. Understand the basic process of photosynthesis
    2. Identify the main components involved in photosynthesis
  outcomes:
    1. Describe the steps of photosynthesis in your own words
    2. Label the parts of a chloroplast and their functions

Module 2
  ...
    */

  return `
You are an expert instructional designer building the high-level narrative arc of a course.

TASK
For each module, write:
- whyThisModule: why this module matters in the overall course
- buildsOn: prior knowledge or earlier module(s) this module depends on
- leadsInto: what this module prepares learners for next

OUTPUT REQUIREMENTS
- Return one entry for EVERY module listed below.
- Use the exact numeric moduleId values exactly as provided.
- Do not invent, remove, merge, or reorder modules.
- Keep each field concise (1-2 sentences, practical and specific).
- Ground your reasoning in the listed objectives and outcomes.
- Write narrative text in ${course.language}.

COURSE CONTEXT
- name: ${course.name}
- subject: ${course.subject}
- language: ${course.language}
- targetAudience: ${course.targetAudience}

MODULES
${modulesBlock}

Return only structured content for the schema with this top-level shape:
{ "modules": [ { "moduleId": number, "whyThisModule": string, "buildsOn": string, "leadsInto": string } ] }
`.trim()
}

// ---------------------------------------------------------------------------
// Pass 2 — module content (sequential)
// ---------------------------------------------------------------------------

async function runPass2(course: FullCourse): Promise<void> {
  for (const module of course.courseModules) {
    console.log(`[generation] Pass 2 — module ${module.order + 1}/${course.courseModules.length}: "${module.name}"`)

    // Fetch concepts already created for this course so we can deduplicate
    const existingConcepts = await prisma.concept.findMany({
      where:  { courseId: course.id },
      select: { id: true, name: true },
    })

    const { output: pass2Result } = await generateText({
      model:  getModel(),
      output: Output.object({ schema: Pass2Schema }),
      prompt: buildPass2Prompt(course, module, existingConcepts),
    })
    const pass2 = pass2Result as Pass2Output

    await writeModuleContent(course.id, module.id, pass2, existingConcepts)
  }
}

function buildPass2Prompt(
  course:           FullCourse,
  module:           FullCourse['courseModules'][number],
  existingConcepts: { id: number; name: string }[],
): string {
  const existingNames = existingConcepts.map(c => c.name)

  return `
You are generating educational content for one module of a course.

Course: ${course.name}
Subject: ${course.subject}
Language: ${course.language}
Target audience: ${course.targetAudience}

Module: ${module.name}
Why this module: ${module.whyThisModule ?? ''}
Builds on: ${module.buildsOn ?? ''}
Leads into: ${module.leadsInto ?? ''}

Learning objectives:
${module.objectives.map(o => `- ${o.text}`).join('\n')}

Learning outcomes:
${module.outcomes.map(o => `- ${o.text}`).join('\n')}

${existingNames.length > 0
  ? `Concepts already created in earlier modules — reuse the exact name if semantically equivalent, otherwise introduce a new name:\n${existingNames.map(n => `- ${n}`).join('\n')}`
  : ''}

Generate:
1. The key concepts for this module. For each concept include ordered theory paragraphs written in clear markdown prose.
2. Exercises that test those concepts. Mix multiple choice and free text. Reference concepts by the exact name you used above.
   - multiple_choice: provide exactly 4 options; correctIndex must be 0, 1, 2, or 3 (the index of the correct option)
   - free_text: provide a sampleAnswer and a rubric describing what a good answer looks like

Respond in ${course.language}.`.trim()
}

// ---------------------------------------------------------------------------
// DB write — module content
// ---------------------------------------------------------------------------

async function writeModuleContent(
  courseId:         number,
  moduleId:         number,
  output:           Pass2Output,
  existingConcepts: { id: number; name: string }[],
): Promise<void> {
  const conceptMap = await resolveConcepts(courseId, moduleId, output.concepts, existingConcepts)

  // Theory blocks
  for (const gen of output.concepts) {
    const concept = conceptMap.get(gen.name)
    if (!concept) continue
    await prisma.theoryBlock.createMany({
      data: gen.theoryBlocks.map((content, order) => ({ conceptId: concept.id, content, order })),
    })
  }

  // Exercises
  let exerciseOrder = 0
  for (const ex of output.exercises) {
    const conceptIds = ex.conceptNames
      .map(name => conceptMap.get(name)?.id)
      .filter((id): id is number => id !== undefined)

    if (conceptIds.length === 0) {
      console.warn(`[generation] Exercise "${ex.question}" has no valid concept links — skipping`)
      continue
    }

    // Normalize MC fields in case the LLM drifted from the prompt instructions
    const options      = ex.options?.slice(0, 4)
    const correctIndex = options ? Math.min(ex.correctIndex ?? 0, options.length - 1) : undefined

    const exercise = await prisma.exercise.create({
      data: {
        courseModuleId: moduleId,
        type:           ex.type === 'multiple_choice' ? 'MULTIPLE_CHOICE' : 'FREE_TEXT',
        question:       ex.question,
        order:          exerciseOrder++,
        options,
        correctIndex,
        explanation:    ex.explanation,
        sampleAnswer:   ex.sampleAnswer,
        rubric:         ex.rubric,
      },
    })

    await prisma.exerciseConcept.createMany({
      data: conceptIds.map(conceptId => ({ exerciseId: exercise.id, conceptId })),
    })
  }
}

// Resolve LLM-returned concept names to DB records.
// Reuses an existing Concept if the name matches (case-insensitive), creates a new one otherwise.
// Also ensures the concept is linked to this module via ModuleConcept.
async function resolveConcepts(
  courseId:          number,
  moduleId:          number,
  generatedConcepts: Pass2Output['concepts'],
  existingConcepts:  { id: number; name: string }[],
): Promise<Map<string, { id: number }>> {
  const conceptMap = new Map<string, { id: number }>()

  for (const [index, gen] of generatedConcepts.entries()) {
    const existing = existingConcepts.find(
      c => c.name.toLowerCase() === gen.name.toLowerCase()
    )

    let conceptId: number
    if (existing) {
      conceptId = existing.id
    } else {
      const created = await prisma.concept.create({ data: { courseId, name: gen.name } })
      conceptId = created.id
    }

    // Link to module — upsert so re-runs don't error if already linked
    await prisma.moduleConcept.upsert({
      where:  { moduleId_conceptId: { moduleId, conceptId } },
      create: { moduleId, conceptId, order: index },
      update: {},
    })

    conceptMap.set(gen.name, { id: conceptId })
  }

  return conceptMap
}
