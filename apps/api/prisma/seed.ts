import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Each template is seeded independently so that adding new templates
  // later won't be skipped by a single early-return guard.

  // Matematik 2b — Swedish national curriculum, Grade 10
  // Source: Skolverket (skolverket.se)
  const matematik2b = await prisma.curriculumTemplate.findFirst({
    where: { country: 'Sweden', name: 'Matematik 2b' },
  })
  if (!matematik2b) {
    await prisma.curriculumTemplate.create({
      data: {
        country: 'Sweden',
        subject: 'Mathematics',
        grade: 'Grade 10',
        name: 'Matematik 2b',
        language: 'Swedish',
        targetAudience: 'Students aged 15–16',
        modules: {
          create: [
            {
              name: 'Algebra',
              order: 0,
              objectives: {
                create: [
                  { text: 'Understand and manipulate algebraic expressions including polynomials' },
                  { text: 'Solve linear equations, inequalities, and quadratic equations' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can expand, simplify, and factor polynomial expressions' },
                  { text: 'Student can solve quadratic equations using the quadratic formula and factoring' },
                  { text: 'Student can solve linear inequalities and represent solutions on a number line' },
                ],
              },
            },
            {
              name: 'Functions',
              order: 1,
              objectives: {
                create: [
                  { text: 'Understand the concept of a function and its properties' },
                  { text: 'Analyse and interpret linear and quadratic functions graphically and algebraically' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify domain, range, zeros, and symmetry of a function' },
                  { text: 'Student can sketch and interpret graphs of linear and quadratic functions' },
                  { text: 'Student can determine the equation of a function from its graph or a set of points' },
                ],
              },
            },
            {
              name: 'Geometry',
              order: 2,
              objectives: {
                create: [
                  { text: 'Apply geometric reasoning and formulas to solve problems involving shapes and space' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can calculate area, perimeter, surface area, and volume for standard shapes' },
                  { text: 'Student can apply the Pythagorean theorem and basic trigonometric ratios (sin, cos, tan)' },
                  { text: 'Student can work with similarity and congruence to determine unknown lengths and angles' },
                ],
              },
            },
            {
              name: 'Statistics',
              order: 3,
              objectives: {
                create: [
                  { text: 'Collect, represent, and critically interpret statistical data' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can calculate and interpret mean, median, mode, and standard deviation' },
                  { text: 'Student can read and construct histograms, box plots, and scatter plots' },
                  { text: 'Student can identify correlation and distinguish it from causation' },
                ],
              },
            },
            {
              name: 'Probability',
              order: 4,
              objectives: {
                create: [
                  { text: 'Understand and apply probability to model and analyse random events' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can calculate probabilities using the addition and multiplication rules' },
                  { text: 'Student can determine outcomes using permutations and combinations' },
                  { text: 'Student can construct and interpret probability trees for multi-step events' },
                ],
              },
            },
            {
              name: 'Problem Solving and Mathematical Reasoning',
              order: 5,
              objectives: {
                create: [
                  { text: 'Develop strategies for solving non-routine mathematical problems' },
                  { text: 'Communicate mathematical reasoning clearly in written form' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify relevant information and select an appropriate strategy for unfamiliar problems' },
                  { text: 'Student can present a complete, logically ordered solution with justifications' },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Seeded: Matematik 2b (Sweden)')
  } else {
    console.log('Already seeded: Matematik 2b (Sweden)')
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
