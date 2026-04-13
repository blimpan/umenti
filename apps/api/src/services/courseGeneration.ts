import { generateText, Output } from 'ai'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { getModel } from '../lib/llm'
import { llmLogger } from '../lib/logger'
import { validateMathSyntax, MathValidationError, MATH_SYNTAX_CONTRACT } from '../lib/mathValidation'
import { extractCanonicalExpressions } from '../lib/mathCreation'

// Describes each template's actual student interaction — referenced in both the
// main Pass 3 prompt and the top-up prompt so they stay consistent.
const INTERACTIVE_QUESTION_GUIDANCE = `
INTERACTIVE EXERCISE QUESTIONS
For interactive exercises, the question field must tell the student exactly what
to do using the specific interaction that template provides. State numeric target
values explicitly — the target state is shown to the student as a dashed outline.

Template interactions:
  cartesian_graph — students use sliders to adjust function parameters.
    Good: "Use the sliders to set the slope to $3$ and the y-intercept to $-1$, forming the line $y = 3x - 1$."
    Bad:  "Explore how changing the slope affects the graph."

  unit_circle — students drag a point around the circle.
    Good: "Drag the point around the circle until the angle reaches $135°$."
    Bad:  "Show the position of $135°$ on the unit circle."

  probability_distribution — students use sliders to adjust distribution parameters.
    Good: "Adjust the sliders until the normal distribution has mean $\\mu = 2$ and standard deviation $\\sigma = 0.5$."
    Bad:  "Set the distribution to show the correct bell curve."

  geometric_shape_explorer — students type values into input fields.
    Good: "Enter the dimensions of a rectangle with width $6$ and height $4$."
    Bad:  "Create a shape with the correct area."
`.trim()

const TEMPLATE_CATALOG = `
CONCEPT CLASSIFICATION
Classify each concept with one of:
  geometric    — spatial relationships, shapes, angles, transformations
  algebraic    — functions with tunable parameters (slope, intercept, coefficients)
  statistical  — distributions, probability, data summaries
  algorithmic  — step-by-step procedures or processes
  definitional — vocabulary, taxonomy, pure classification
  relational   — connections between concepts, sets, hierarchies

VISUALIZATION TEMPLATES
Only geometric, algebraic, and statistical concepts may have visualizations.
Set visualizations to [] for all other types.

For eligible concepts choose one or more templates:

  cartesian_graph  (algebraic)
    mode: 'linear' | 'quadratic' | 'sinusoidal'
    params (linear):     { mode, slope, intercept }
    params (quadratic):  { mode, a, b, c }
    params (sinusoidal): { mode, amplitude, frequency, phase }
    optional: xMin, xMax

  unit_circle  (geometric)
    params: { initialAngle, unit ('degrees'|'radians'), showComponents, showTan }

  probability_distribution  (statistical)
    params (normal):   { distribution: 'normal', mean, stdDev }
    params (binomial): { distribution: 'binomial', n, p }

  geometric_shape_explorer  (geometric)
    params: { shape ('rectangle'|'circle'|'right_triangle'), width+height OR radius OR base+legHeight, showArea, showPerimeter }

Set templateId to the template name above.
Set templateParamsJson to a JSON-encoded string of the params object.
Use templateId "custom" only when no template fits AND the concept is strongly spatial or dynamic.
When templateId is "custom", set visualizationHtml to a complete self-contained HTML document.
`.trim()

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

const Pass2VisualizationSchema = z.object({
  templateId:         z.string(),           // "cartesian_graph" | "unit_circle" | etc. | "custom"
  templateParamsJson: z.string(),           // JSON-encoded params; empty string for 'custom'
  visualizationHtml:  z.string().nullable(), // only populated when templateId = 'custom'
})

const Pass2Schema = z.object({
  concepts: z.array(z.object({
    name:           z.string(),
    conceptType:    z.enum(['geometric', 'algebraic', 'statistical', 'algorithmic', 'definitional', 'relational']),
    theoryBlocks:   z.array(z.string()),
    visualizations: z.array(Pass2VisualizationSchema),
    // visualizations is empty array for algorithmic, definitional, relational types
  })),
})

// Flat schema — avoids oneOf/anyOf which Anthropic structured output does not support.
// type-specific fields are optional; the `type` enum drives which are populated.
// Array constraints above minItems:1 are also unsupported, so we rely on the prompt
// to instruct the LLM (e.g. "provide exactly 4 options").
const Pass3Schema = z.object({
  exercises: z.array(z.object({
    type:              z.enum(['multiple_choice', 'free_text', 'interactive']),
    conceptNames:      z.array(z.string()),
    question:          z.string(),
    // multiple_choice fields
    options:           z.array(z.string()).nullable(),
    correctIndex:      z.number().nullable(),
    explanation:       z.string().nullable(),
    // free_text fields
    sampleAnswer:      z.string().nullable(),
    rubric:            z.string().nullable(),
    // interactive — LLM picks its own template independently
    templateId:         z.string().nullable(),       // e.g. "cartesian_graph"
    templateParamsJson: z.string().nullable(),       // JSON-encoded initial params
    visualizationHtml:  z.string().nullable(),       // only when templateId = "custom"
    // targetState is JSON-encoded string — z.record() generates propertyNames which
    // OpenAI/Anthropic structured output forbids. Parse to object after generation.
    targetState:        z.string().nullable(),
  })),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FullCourse  = Awaited<ReturnType<typeof loadCourseData>>
type Pass1Output = z.infer<typeof Pass1Schema>
type Pass2Output = z.infer<typeof Pass2Schema>
type Pass3Output = z.infer<typeof Pass3Schema>
type ModuleConceptWithBlocks = Awaited<ReturnType<typeof loadModuleConcepts>>[number]

// ---------------------------------------------------------------------------
// Math-validated generation helper
// ---------------------------------------------------------------------------

// Runs generateText, validates all string fields in the output against the
// math syntax contract, and retries once with a corrective prompt if errors
// are found. Always returns output — on second failure it logs and proceeds
// rather than blocking the pipeline entirely.
async function generateWithMathValidation<T>(opts: {
  tag:              string          // used in log lines, e.g. "Pass 2 module 3"
  schema:           z.ZodType<T>
  prompt:           string
  extractStrings:   (output: T) => string[]
  correctivePrompt: (output: T, errors: MathValidationError[]) => string
}): Promise<T> {
  const tag = `[generation:${opts.tag}]`

  const raw = await generateText({
    model:  getModel(),
    output: Output.object({ schema: opts.schema }),
    prompt: opts.prompt,
  })

  llmLogger.info({ finishReason: raw.finishReason, usage: raw.usage }, tag)
  if (raw.finishReason !== 'stop') {
    llmLogger.warn({ finishReason: raw.finishReason }, `${tag} unexpected finishReason — output may be truncated`)
  }

  const first = raw.output as T

  const allErrors = opts.extractStrings(first).flatMap(s => validateMathSyntax(s).errors)
  if (allErrors.length === 0) {
    llmLogger.info(tag + ' math validation passed')
    return first
  }

  llmLogger.warn({ errorCount: allErrors.length, errors: allErrors }, `${tag} math validation failed — retrying once`)

  // TODO: the corrective prompt includes the full output JSON which can be large
  // for modules with many exercises. Consider sending only the failing field paths
  // and their values to reduce token spend on the retry.
  const retryRaw = await generateText({
    model:  getModel(),
    output: Output.object({ schema: opts.schema }),
    prompt: opts.correctivePrompt(first, allErrors),
  })

  llmLogger.info({ finishReason: retryRaw.finishReason, usage: retryRaw.usage }, `${tag} retry`)
  if (retryRaw.finishReason !== 'stop') {
    llmLogger.warn({ finishReason: retryRaw.finishReason }, `${tag} retry had unexpected finishReason`)
  }

  const second = retryRaw.output as T

  const retryErrors = opts.extractStrings(second).flatMap(s => validateMathSyntax(s).errors)
  if (retryErrors.length > 0) {
    llmLogger.error({ errorCount: retryErrors.length, errors: retryErrors }, `${tag} math validation still failing after retry — persisting anyway`)
  } else {
    llmLogger.info(`${tag} math validation passed after retry`)
  }

  return second
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function triggerGeneration(courseId: number): Promise<void> {
  llmLogger.info({ courseId }, '[generation] Starting pipeline')
  try {
    const course = await loadCourseData(courseId)
    await runPass1(course)
    await runPass2(course)
    await runPass3(course)
    await prisma.course.update({ where: { id: courseId }, data: { status: 'DRAFT' } })
    llmLogger.info({ courseId }, '[generation] Pipeline complete')
  } catch (err) {
    llmLogger.error({ err, courseId }, '[generation] Pipeline failed')
    await prisma.course.update({ where: { id: courseId }, data: { status: 'FAILED' } }).catch(e => llmLogger.error({ err: e }, '[generation] Failed to set FAILED status'))
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
  llmLogger.info({ courseId: course.id }, '[generation] Pass 1 — skeleton')

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
    llmLogger.info({ moduleId: module.id, name: module.name, progress: `${module.order + 1}/${course.courseModules.length}` }, '[generation] Pass 2 — module')

    // Fetch concepts already created for this course so we can deduplicate
    const existingConcepts = await prisma.concept.findMany({
      where:  { courseId: course.id },
      select: { id: true, name: true },
    })

    const pass2 = await generateWithMathValidation({
      tag:    `Pass2 module=${module.id}`,
      schema: Pass2Schema,
      prompt: buildPass2Prompt(course, module, existingConcepts),
      extractStrings: (output) => output.concepts.flatMap(c => c.theoryBlocks),
      correctivePrompt: (output, errors) => `
Your previous response contained math formatting errors. Fix ONLY the math syntax — do not change any content.

ERRORS FOUND
${errors.map(e => `- [${e.rule}] ${e.detail}`).join('\n')}

${MATH_SYNTAX_CONTRACT}

PREVIOUS OUTPUT (fix the math syntax in this)
${JSON.stringify(output, null, 2)}
`.trim(),
    })

    await writeModuleConcepts(course.id, module.id, pass2, existingConcepts)
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

Generate the key concepts for this module. For each concept include ordered theory paragraphs written in clear markdown prose.

${MATH_SYNTAX_CONTRACT}

${TEMPLATE_CATALOG}

Respond in ${course.language}.`.trim()
}

// ---------------------------------------------------------------------------
// DB write — module content
// ---------------------------------------------------------------------------

async function writeModuleConcepts(
  courseId:         number,
  moduleId:         number,
  output:           Pass2Output,
  existingConcepts: { id: number; name: string }[],
): Promise<void> {
  const conceptMap = await resolveConcepts(courseId, moduleId, output.concepts, existingConcepts)

  for (const gen of output.concepts) {
    const concept = conceptMap.get(gen.name)
    if (!concept) continue

    // Store conceptType on the Concept row
    await prisma.concept.update({
      where: { id: concept.id },
      data:  { conceptType: gen.conceptType },
    })

    // Delete existing child records before recreating — makes this function
    // idempotent so retries or regeneration don't append duplicate rows.
    await prisma.theoryBlock.deleteMany({ where: { conceptId: concept.id } })
    await prisma.conceptVisualization.deleteMany({ where: { conceptId: concept.id } })

    await prisma.theoryBlock.createMany({
      data: gen.theoryBlocks.map((content, order) => ({ conceptId: concept.id, content, order })),
    })

    // Write each visualization as a ConceptVisualization row
    if (gen.visualizations.length > 0) {
      await prisma.conceptVisualization.createMany({
        data: gen.visualizations.map((viz, order) => ({
          conceptId:          concept.id,
          order,
          visualizationType:  viz.templateId,
          visualizationParams: viz.templateId !== 'custom' && viz.templateParamsJson
            ? (() => { try { return JSON.parse(viz.templateParamsJson) } catch { return {} } })()
            : {},
          visualization: viz.templateId === 'custom' ? viz.visualizationHtml : null,
        })),
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Pass 3 — exercise generation (sequential, after all concepts exist)
// ---------------------------------------------------------------------------

async function loadModuleConcepts(moduleId: number) {
  return prisma.moduleConcept.findMany({
    where:   { moduleId },
    orderBy: { order: 'asc' },
    include: {
      concept: {
        include: { theoryBlocks: { orderBy: { order: 'asc' } } },
      },
    },
  })
}

async function runPass3(course: FullCourse): Promise<void> {
  for (const module of course.courseModules) {
    llmLogger.info({ moduleId: module.id, name: module.name, progress: `${module.order + 1}/${course.courseModules.length}` }, '[generation] Pass 3 — module')

    const moduleConcepts = await loadModuleConcepts(module.id)

    if (moduleConcepts.length === 0) {
      llmLogger.warn({ moduleId: module.id, name: module.name }, '[generation] Module has no concepts — skipping exercise generation')
      continue
    }

    const pass3Result = await generateWithMathValidation({
      tag:    `Pass3 module=${module.id}`,
      schema: Pass3Schema,
      prompt: buildPass3Prompt(course, module, moduleConcepts),
      extractStrings: (output) => output.exercises.flatMap(ex => [
        ex.question,
        ...(ex.options ?? []),
        ex.explanation  ?? '',
        ex.sampleAnswer ?? '',
        ex.rubric       ?? '',
        // visualizationHtml intentionally excluded — not math text
      ]),
      correctivePrompt: (output, errors) => `
Your previous response contained math formatting errors. Fix ONLY the math syntax — do not change any content.

ERRORS FOUND
${errors.map(e => `- [${e.rule}] ${e.detail}`).join('\n')}

${MATH_SYNTAX_CONTRACT}

PREVIOUS OUTPUT (fix the math syntax in this)
${JSON.stringify(output, null, 2)}
`.trim(),
    })

    await writeModuleExercises(module.id, pass3Result, moduleConcepts)
    await topUpConceptExercises(module.id, moduleConcepts, course)
  }
}

// Checks exercise counts per concept after Pass 3 and makes targeted top-up
// calls for any concept with fewer than 2 exercises. Safe to call even if all
// concepts already meet the threshold — returns immediately in that case.
async function topUpConceptExercises(
  moduleId:       number,
  moduleConcepts: ModuleConceptWithBlocks[],
  course:         FullCourse,
): Promise<void> {
  const conceptIds = moduleConcepts.map(mc => mc.conceptId)

  // Count exercises per concept for this module
  const links = await prisma.exerciseConcept.findMany({
    where: {
      conceptId: { in: conceptIds },
      exercise:  { courseModuleId: moduleId },
    },
    select: {
      conceptId: true,
      exercise:  { select: { question: true } },
    },
  })

  const countByConcept    = new Map<number, number>()
  const questionsByConcept = new Map<number, string[]>()
  for (const link of links) {
    countByConcept.set(link.conceptId, (countByConcept.get(link.conceptId) ?? 0) + 1)
    const qs = questionsByConcept.get(link.conceptId) ?? []
    qs.push(link.exercise.question)
    questionsByConcept.set(link.conceptId, qs)
  }

  const deficient = moduleConcepts.filter(mc => (countByConcept.get(mc.conceptId) ?? 0) < 2)
  if (deficient.length === 0) return

  llmLogger.info(
    { moduleId, count: deficient.length, concepts: deficient.map(mc => mc.concept.name) },
    '[generation] top-up: concepts need more exercises',
  )

  for (const mc of deficient) {
    const needed           = 2 - (countByConcept.get(mc.conceptId) ?? 0)
    const existingQuestions = questionsByConcept.get(mc.conceptId) ?? []
    const theory           = mc.concept.theoryBlocks.map(b => b.content).join('\n\n')

    try {
      const result = await generateWithMathValidation({
        tag:    `Pass3-topup concept=${mc.conceptId}`,
        schema: Pass3Schema,
        prompt: buildTopUpPrompt(course, mc.concept.name, theory, existingQuestions, needed),
        extractStrings: (output) => output.exercises.flatMap(ex => [
          ex.question,
          ...(ex.options ?? []),
          ex.explanation  ?? '',
          ex.sampleAnswer ?? '',
          ex.rubric       ?? '',
        ]),
        correctivePrompt: (output, errors) => `
Your previous response contained math formatting errors. Fix ONLY the math syntax — do not change any content.

ERRORS FOUND
${errors.map(e => `- [${e.rule}] ${e.detail}`).join('\n')}

${MATH_SYNTAX_CONTRACT}

PREVIOUS OUTPUT (fix the math syntax in this)
${JSON.stringify(output, null, 2)}
`.trim(),
      })

      await writeModuleExercises(moduleId, result, moduleConcepts)
    } catch (err) {
      llmLogger.warn({ err, conceptId: mc.conceptId, name: mc.concept.name }, '[generation] top-up: failed for concept — skipping')
    }
  }

  // Warn for any concept that still falls short after top-up
  const afterLinks = await prisma.exerciseConcept.findMany({
    where: {
      conceptId: { in: deficient.map(mc => mc.conceptId) },
      exercise:  { courseModuleId: moduleId },
    },
    select: { conceptId: true },
  })
  const afterCount = new Map<number, number>()
  for (const link of afterLinks) {
    afterCount.set(link.conceptId, (afterCount.get(link.conceptId) ?? 0) + 1)
  }
  for (const mc of deficient) {
    if ((afterCount.get(mc.conceptId) ?? 0) < 2) {
      llmLogger.warn(
        { conceptId: mc.conceptId, name: mc.concept.name, count: afterCount.get(mc.conceptId) ?? 0 },
        '[generation] top-up: concept still has fewer than 2 exercises after top-up',
      )
    }
  }
}

function buildTopUpPrompt(
  course:            FullCourse,
  conceptName:       string,
  theory:            string,
  existingQuestions: string[],
  needed:            number,
): string {
  const existingBlock = existingQuestions.length > 0
    ? `Existing exercise questions for this concept (do not duplicate):\n${existingQuestions.map(q => `- ${q}`).join('\n')}`
    : ''

  return `
You are generating additional exercises for one concept in a course.

Course: ${course.name}
Subject: ${course.subject}
Language: ${course.language}
Target audience: ${course.targetAudience}

Concept: ${conceptName}
Theory:
${theory}

${existingBlock}

Generate exactly ${needed} new exercise(s) for this concept.
Requirements:
- Each exercise must set conceptNames to ["${conceptName}"]
- Prefer exercise types not already used for this concept
- multiple_choice: provide exactly 4 options; correctIndex must be 0, 1, 2, or 3
- free_text: provide a sampleAnswer and a rubric describing what a good answer looks like
- You may also generate an interactive exercise where appropriate
- interactive: pick templateId + templateParamsJson (initial state) + targetState (JSON-encoded target)
- Exercises must test understanding at the level appropriate for: ${course.targetAudience}

${INTERACTIVE_QUESTION_GUIDANCE}

${MATH_SYNTAX_CONTRACT}

${TEMPLATE_CATALOG}

Respond in ${course.language}.
`.trim()
}

function buildPass3Prompt(
  course:         FullCourse,
  module:         FullCourse['courseModules'][number],
  moduleConcepts: ModuleConceptWithBlocks[],
): string {
  const conceptsBlock = moduleConcepts
    .map(mc => {
      const theory = mc.concept.theoryBlocks.map(b => b.content).join('\n\n')
      return `Concept: ${mc.concept.name}\n${theory}`
    })
    .join('\n\n---\n\n')

  return `
You are generating exercises for one module of a course. Your exercises must be grounded in the concept theory below.

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

CONCEPTS AND THEORY FOR THIS MODULE
${conceptsBlock}

TASK
Generate exercises that test the concepts above. Requirements:
- Generate at least 2 exercises per concept. Every concept listed above must appear in conceptNames of at least 2 exercises.
- Where possible, use different exercise types for the same concept (e.g. one multiple_choice and one free_text).
- Reference concepts using the EXACT names listed above (conceptNames field)
- Each exercise must link to at least one concept
- multiple_choice: provide exactly 4 options; correctIndex must be 0, 1, 2, or 3
- free_text: provide a sampleAnswer and a rubric describing what a good answer looks like
- Exercises must test understanding at the level appropriate for: ${course.targetAudience}
- You may also generate interactive exercises (type: "interactive") where the student manipulates a visualization to reach a target state. Use this for concepts where hands-on manipulation is more meaningful than text answers.
- interactive: pick templateId + templateParamsJson (initial state) + targetState (JSON-encoded target). You choose the template independently — it does not need to match any theory block visualization.

${INTERACTIVE_QUESTION_GUIDANCE}

${MATH_SYNTAX_CONTRACT}

${TEMPLATE_CATALOG}

Respond in ${course.language}.`.trim()
}

async function writeModuleExercises(
  moduleId:       number,
  output:         Pass3Output,
  moduleConcepts: ModuleConceptWithBlocks[],
): Promise<void> {
  const conceptMap = new Map(moduleConcepts.map(mc => [mc.concept.name.toLowerCase(), mc.concept.id]))

  // Start after any existing exercises so top-up calls append rather than restart.
  const maxOrderRow = await prisma.exercise.findFirst({
    where:   { courseModuleId: moduleId },
    orderBy: { order: 'desc' },
    select:  { order: true },
  })
  let exerciseOrder = maxOrderRow ? maxOrderRow.order + 1 : 0
  for (const ex of output.exercises) {
    const conceptIds = ex.conceptNames
      .map(name => conceptMap.get(name.toLowerCase()))
      .filter((id): id is number => id !== undefined)

    if (conceptIds.length === 0) {
      llmLogger.warn({ question: ex.question.slice(0, 80) }, '[generation] Exercise has no valid concept links — skipping')
      continue
    }

    // Normalize MC fields in case the LLM drifted from the prompt instructions
    const options      = ex.type === 'multiple_choice' ? (ex.options?.slice(0, 4) ?? undefined) : undefined
    const correctIndex = options ? Math.min(ex.correctIndex ?? 0, options.length - 1) : null

    // Map to DB enum
    const exerciseType =
      ex.type === 'multiple_choice' ? 'MULTIPLE_CHOICE' :
      ex.type === 'free_text'       ? 'FREE_TEXT'       :
                                      'INTERACTIVE'

    // Strip bytes Postgres rejects in UTF-8 columns (null bytes, non-characters).
    const sanitize = (s: string | undefined | null) =>
      s?.replace(/\x00/g, '').replace(/[\uFFFE\uFFFF]/g, '')

    const exercise = await prisma.exercise.create({
      data: {
        courseModuleId:    moduleId,
        type:              exerciseType,
        question:          sanitize(ex.question) ?? ex.question,
        order:             exerciseOrder++,
        options:           options?.map(o => sanitize(o) ?? o),
        correctIndex,
        explanation:       sanitize(ex.explanation),
        sampleAnswer:      sanitize(ex.sampleAnswer),
        rubric:            sanitize(ex.rubric),
        visualizationHtml:   sanitize(ex.visualizationHtml) ?? null,
        visualizationType:   ex.templateId ?? null,
        visualizationParams: ex.templateId && ex.templateId !== 'custom' && ex.templateParamsJson
          ? (() => { try { return JSON.parse(ex.templateParamsJson) } catch { return undefined } })()
          : undefined,
        targetState: ex.targetState ? JSON.parse(ex.targetState) : undefined,
      },
    })

    await prisma.exerciseConcept.createMany({
      data: conceptIds.map(conceptId => ({ exerciseId: exercise.id, conceptId })),
    })

    // Creation agent: extract and store canonical expressions for FREE_TEXT exercises.
    // Runs after the exercise row exists so a failure here never blocks persistence.
    if (exerciseType === 'FREE_TEXT' && ex.sampleAnswer) {
      const canonicalExpressions = await extractCanonicalExpressions(ex.question, ex.sampleAnswer)
      if (canonicalExpressions.length > 0) {
        await prisma.exercise.update({
          where: { id: exercise.id },
          data:  { canonicalExpressions },
        })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Concept resolution
// ---------------------------------------------------------------------------

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
