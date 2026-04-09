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

  // Common Core Geometry — US Common Core State Standards, Grade 10
  // Source: Common Core State Standards Initiative (corestandards.org)
  const ccGeometry = await prisma.curriculumTemplate.findFirst({
    where: { country: 'United States', name: 'Common Core Geometry' },
  })
  if (!ccGeometry) {
    await prisma.curriculumTemplate.create({
      data: {
        country: 'United States',
        subject: 'Mathematics',
        grade: 'Grade 10',
        name: 'Common Core Geometry',
        language: 'English',
        targetAudience: 'Students aged 15–16',
        modules: {
          create: [
            {
              name: 'Congruence and Transformations',
              order: 0,
              objectives: {
                create: [
                  { text: 'Understand geometric transformations and use them to define congruence' },
                  { text: 'Prove geometric theorems about lines, angles, triangles, and parallelograms' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can perform and describe translations, rotations, and reflections on the coordinate plane' },
                  { text: 'Student can prove triangle congruence using SSS, SAS, ASA, AAS, and HL criteria' },
                  { text: 'Student can apply properties of parallel lines cut by a transversal to find missing angles' },
                ],
              },
            },
            {
              name: 'Similarity and Proportional Reasoning',
              order: 1,
              objectives: {
                create: [
                  { text: 'Understand similarity as proportional scaling and use it to solve geometric problems' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify similar figures and state the scale factor between them' },
                  { text: 'Student can prove triangle similarity using AA, SAS, and SSS criteria' },
                  { text: 'Student can use similarity to find missing side lengths and angle measures in geometric figures' },
                ],
              },
            },
            {
              name: 'Right Triangles and Trigonometry',
              order: 2,
              objectives: {
                create: [
                  { text: 'Apply the Pythagorean theorem and trigonometric ratios to solve problems involving right triangles' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can solve for missing sides and angles in right triangles using sin, cos, and tan' },
                  { text: 'Student can apply the 30-60-90 and 45-45-90 special triangle relationships without a calculator' },
                  { text: 'Student can model and solve real-world problems using trigonometric ratios and the Pythagorean theorem' },
                ],
              },
            },
            {
              name: 'Circles',
              order: 3,
              objectives: {
                create: [
                  { text: 'Understand and apply theorems about circles, arcs, and angles' },
                  { text: 'Derive and use the equation of a circle in the coordinate plane' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can calculate arc length and sector area given a central angle and radius' },
                  { text: 'Student can apply theorems about inscribed angles, chords, secants, and tangent lines' },
                  { text: 'Student can write and interpret the equation of a circle in standard form' },
                ],
              },
            },
            {
              name: 'Coordinate Geometry',
              order: 4,
              objectives: {
                create: [
                  { text: 'Use coordinates and algebraic methods to prove geometric theorems and solve problems' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can apply the distance and midpoint formulas to classify and analyse geometric figures' },
                  { text: 'Student can prove geometric theorems (e.g. a quadrilateral is a parallelogram) using coordinate methods' },
                  { text: 'Student can find equations of lines that are parallel or perpendicular to a given line through a given point' },
                ],
              },
            },
            {
              name: 'Geometric Measurement and Modeling',
              order: 5,
              objectives: {
                create: [
                  { text: 'Apply area and volume formulas to solve real-world measurement problems' },
                  { text: 'Use geometric models to represent and solve design and density problems' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can calculate surface area and volume of prisms, cylinders, pyramids, cones, and spheres' },
                  { text: 'Student can identify the two-dimensional cross-section produced by slicing a three-dimensional figure' },
                  { text: 'Student can apply geometric concepts such as density and scale to solve real-world design problems' },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Seeded: Common Core Geometry (United States)')
  } else {
    console.log('Already seeded: Common Core Geometry (United States)')
  }

  // Mathematik Klasse 10 — German KMK standards, Grade 10
  // Source: Kultusministerkonferenz (kmk.org)
  const mathematikKlasse10 = await prisma.curriculumTemplate.findFirst({
    where: { country: 'Germany', name: 'Mathematik Klasse 10' },
  })
  if (!mathematikKlasse10) {
    await prisma.curriculumTemplate.create({
      data: {
        country: 'Germany',
        subject: 'Mathematics',
        grade: 'Grade 10',
        name: 'Mathematik Klasse 10',
        language: 'German',
        targetAudience: 'Students aged 15–16',
        modules: {
          create: [
            {
              name: 'Algebra und Gleichungen',
              order: 0,
              objectives: {
                create: [
                  { text: 'Algebraische Ausdrücke und Gleichungssysteme verstehen und anwenden' },
                  { text: 'Quadratische und lineare Gleichungen lösen und interpretieren' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can expand, factorise, and simplify polynomial expressions' },
                  { text: 'Student can solve systems of linear equations using substitution and elimination' },
                  { text: 'Student can solve quadratic equations using the quadratic formula and factoring' },
                ],
              },
            },
            {
              name: 'Funktionen',
              order: 1,
              objectives: {
                create: [
                  { text: 'Funktionsbegriff und Eigenschaften quadratischer und exponentieller Funktionen verstehen' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify domain, range, vertex, and axis of symmetry of a quadratic function' },
                  { text: 'Student can sketch and interpret graphs of quadratic and exponential functions' },
                  { text: 'Student can determine the equation of a function from its graph or a table of values' },
                ],
              },
            },
            {
              name: 'Geometrie und Trigonometrie',
              order: 2,
              objectives: {
                create: [
                  { text: 'Geometrische Figuren und trigonometrische Zusammenhänge analysieren und anwenden' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can apply the sine and cosine rules to find missing sides and angles in triangles' },
                  { text: 'Student can calculate area, perimeter, surface area, and volume of standard geometric figures' },
                  { text: 'Student can use similarity and congruence criteria to solve geometric problems' },
                ],
              },
            },
            {
              name: 'Statistik und Wahrscheinlichkeit',
              order: 3,
              objectives: {
                create: [
                  { text: 'Statistische Daten erheben, darstellen und auswerten sowie Wahrscheinlichkeiten berechnen' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can calculate and interpret mean, median, mode, and standard deviation for a data set' },
                  { text: 'Student can construct and read histograms, box plots, and scatter plots' },
                  { text: 'Student can compute probabilities using the addition rule, multiplication rule, and tree diagrams' },
                ],
              },
            },
            {
              name: 'Mathematisches Modellieren',
              order: 4,
              objectives: {
                create: [
                  { text: 'Mathematische Modelle zur Beschreibung und Lösung realer Probleme entwickeln und bewerten' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify relevant mathematical structures in real-world problems and select an appropriate model' },
                  { text: 'Student can interpret results of a mathematical model in context and evaluate its limitations' },
                  { text: 'Student can present a solution using correct mathematical notation and clear reasoning' },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Seeded: Mathematik Klasse 10 (Germany)')
  } else {
    console.log('Already seeded: Mathematik Klasse 10 (Germany)')
  }

  // Mathématiques Seconde — French national curriculum, Grade 10
  // Source: Ministère de l'Éducation nationale (education.gouv.fr)
  const mathSeconde = await prisma.curriculumTemplate.findFirst({
    where: { country: 'France', name: 'Mathématiques Seconde' },
  })
  if (!mathSeconde) {
    await prisma.curriculumTemplate.create({
      data: {
        country: 'France',
        subject: 'Mathematics',
        grade: 'Grade 10',
        name: 'Mathématiques Seconde',
        language: 'French',
        targetAudience: 'Students aged 15–16',
        modules: {
          create: [
            {
              name: 'Algèbre et Équations',
              order: 0,
              objectives: {
                create: [
                  { text: 'Résoudre des équations et inéquations du premier et second degré' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can solve linear and quadratic equations algebraically and graphically' },
                  { text: 'Student can solve systems of two linear equations and interpret the solution geometrically' },
                  { text: 'Student can represent and solve linear inequalities on a number line' },
                ],
              },
            },
            {
              name: 'Fonctions',
              order: 1,
              objectives: {
                create: [
                  { text: 'Comprendre le concept de fonction et analyser les fonctions linéaires et quadratiques' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can determine the domain, image, and zeros of a function from its formula or graph' },
                  { text: 'Student can sketch and interpret graphs of linear, quadratic, and square root functions' },
                  { text: 'Student can identify whether a function is increasing or decreasing on a given interval' },
                ],
              },
            },
            {
              name: 'Géométrie et Vecteurs',
              order: 2,
              objectives: {
                create: [
                  { text: 'Utiliser les vecteurs et les coordonnées pour résoudre des problèmes géométriques' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can perform vector addition, subtraction, and scalar multiplication' },
                  { text: 'Student can apply the Pythagorean theorem and basic trigonometric ratios in right triangles' },
                  { text: 'Student can use coordinates to calculate distances and determine geometric properties of figures' },
                ],
              },
            },
            {
              name: 'Suites Numériques',
              order: 3,
              objectives: {
                create: [
                  { text: 'Comprendre et manipuler les suites arithmétiques et géométriques' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify whether a sequence is arithmetic or geometric and state its common difference or ratio' },
                  { text: 'Student can calculate any term of an arithmetic or geometric sequence using the explicit formula' },
                  { text: 'Student can apply sequences to model real-world growth and financial problems' },
                ],
              },
            },
            {
              name: 'Statistiques et Probabilités',
              order: 4,
              objectives: {
                create: [
                  { text: 'Analyser des données statistiques et calculer des probabilités d\'événements' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can calculate mean, median, quartiles, and interquartile range for a data set' },
                  { text: 'Student can construct and interpret frequency tables, histograms, and box plots' },
                  { text: 'Student can calculate probabilities of single and compound events using sample spaces and tree diagrams' },
                ],
              },
            },
            {
              name: 'Raisonnement et Démonstration',
              order: 5,
              objectives: {
                create: [
                  { text: 'Développer la rigueur du raisonnement mathématique et la capacité à démontrer des propriétés' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can distinguish between a conjecture and a proof and identify logical errors in an argument' },
                  { text: 'Student can write a clear, structured proof for geometric and algebraic properties' },
                  { text: 'Student can use counterexamples to disprove a false statement' },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Seeded: Mathématiques Seconde (France)')
  } else {
    console.log('Already seeded: Mathématiques Seconde (France)')
  }

  // Introduction to Business and Entrepreneurship — US high school Business curriculum, Grade 10
  // Source: Common US high school Business/CTE curriculum standards
  const usBusinessIntro = await prisma.curriculumTemplate.findFirst({
    where: { country: 'United States', name: 'Introduction to Business and Entrepreneurship' },
  })
  if (!usBusinessIntro) {
    await prisma.curriculumTemplate.create({
      data: {
        country: 'United States',
        subject: 'Business',
        grade: 'Grade 10',
        name: 'Introduction to Business and Entrepreneurship',
        language: 'English',
        targetAudience: 'Students aged 15–16',
        modules: {
          create: [
            {
              name: 'Business Fundamentals',
              order: 0,
              objectives: {
                create: [
                  { text: 'Understand the structure of the economy and the different forms of business ownership' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can compare sole proprietorships, partnerships, corporations, and LLCs by liability, control, and taxation' },
                  { text: 'Student can explain how supply, demand, and competition shape prices and business decisions' },
                  { text: 'Student can identify examples of ethical and unethical business behaviour and justify the distinction' },
                ],
              },
            },
            {
              name: 'Entrepreneurship and Ideation',
              order: 1,
              objectives: {
                create: [
                  { text: 'Develop the mindset and tools needed to identify business opportunities and evaluate their viability' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can generate a business idea and validate it using a problem–solution framework' },
                  { text: 'Student can conduct a basic feasibility analysis covering market demand, cost, and competition' },
                  { text: 'Student can draft the key sections of a simple business plan (concept, target market, revenue model)' },
                ],
              },
            },
            {
              name: 'Marketing and Sales',
              order: 2,
              objectives: {
                create: [
                  { text: 'Understand how businesses identify customer needs and design strategies to reach their target market' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can define a target market and describe its demographic, geographic, and psychographic characteristics' },
                  { text: 'Student can apply the 4 Ps of marketing (Product, Price, Place, Promotion) to a given business scenario' },
                  { text: 'Student can design a simple marketing campaign for a product or service' },
                ],
              },
            },
            {
              name: 'Finance and Accounting',
              order: 3,
              objectives: {
                create: [
                  { text: 'Understand how businesses track, manage, and report their financial performance' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can create a simple budget and distinguish between fixed and variable costs' },
                  { text: 'Student can read a basic income statement and identify revenue, expenses, and net income' },
                  { text: 'Student can explain the difference between cash flow and profit and why both matter' },
                ],
              },
            },
            {
              name: 'Management and Organisation',
              order: 4,
              objectives: {
                create: [
                  { text: 'Understand how businesses organise their people and operations to achieve goals' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can draw and interpret an organisational chart and describe the role of each level' },
                  { text: 'Student can compare management styles (autocratic, democratic, laissez-faire) and their appropriate contexts' },
                  { text: 'Student can explain core HR functions: recruitment, training, performance evaluation, and retention' },
                ],
              },
            },
            {
              name: 'Business Law and Ethics',
              order: 5,
              objectives: {
                create: [
                  { text: 'Understand the legal and ethical obligations that govern business activity' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify the elements of a valid contract and explain what makes one enforceable' },
                  { text: 'Student can distinguish between civil and criminal business liability with examples' },
                  { text: 'Student can apply an ethical decision-making framework to a realistic business dilemma' },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Seeded: Introduction to Business and Entrepreneurship (United States)')
  } else {
    console.log('Already seeded: Introduction to Business and Entrepreneurship (United States)')
  }

  // Företagsekonomi 1 — Swedish gymnasieskola Business curriculum
  // Source: Skolverket (skolverket.se)
  const foretagsekonomi1 = await prisma.curriculumTemplate.findFirst({
    where: { country: 'Sweden', name: 'Företagsekonomi 1' },
  })
  if (!foretagsekonomi1) {
    await prisma.curriculumTemplate.create({
      data: {
        country: 'Sweden',
        subject: 'Business',
        grade: 'Grade 10',
        name: 'Företagsekonomi 1',
        language: 'Swedish',
        targetAudience: 'Students aged 15–16',
        modules: {
          create: [
            {
              name: 'Företagande och Organisation',
              order: 0,
              objectives: {
                create: [
                  { text: 'Förstå hur företag bildas, organiseras och verkar i samhället' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can compare different business forms (enskild firma, HB, AB) by liability, ownership, and tax implications' },
                  { text: 'Student can describe common organisational structures and explain the role of each function' },
                  { text: 'Student can outline the legal steps required to register and start a business in Sweden' },
                ],
              },
            },
            {
              name: 'Ekonomiska Grundbegrepp',
              order: 1,
              objectives: {
                create: [
                  { text: 'Förstå grundläggande ekonomiska mekanismer och deras påverkan på företag' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can explain how supply and demand determine prices in a market' },
                  { text: 'Student can describe the role of interest rates, inflation, and economic cycles for business planning' },
                  { text: 'Student can distinguish between microeconomic and macroeconomic factors affecting a company' },
                ],
              },
            },
            {
              name: 'Entreprenörskap',
              order: 2,
              objectives: {
                create: [
                  { text: 'Utveckla ett entreprenöriellt tänkande och förmåga att planera ett företag' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify a market gap and articulate a value proposition for a business idea' },
                  { text: 'Student can conduct a basic SWOT analysis for a startup concept' },
                  { text: 'Student can draft the key sections of a business plan (affärsidé, marknad, finansiering)' },
                ],
              },
            },
            {
              name: 'Företagets Ekonomi',
              order: 3,
              objectives: {
                create: [
                  { text: 'Förstå hur ett företag planerar, redovisar och analyserar sin ekonomi' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can create a simple budget and distinguish between rörliga and fasta kostnader' },
                  { text: 'Student can read a basic resultaträkning and identify intäkter, kostnader, and rörelseresultat' },
                  { text: 'Student can explain the importance of likviditet and distinguish it from lönsamhet' },
                ],
              },
            },
            {
              name: 'Marknadsföring',
              order: 4,
              objectives: {
                create: [
                  { text: 'Förstå hur företag identifierar kundernas behov och utformar marknadsstrategier' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can define a target segment and describe its key characteristics' },
                  { text: 'Student can apply the marketing mix (produkt, pris, plats, påverkan) to a given product or service' },
                  { text: 'Student can plan a basic marketing campaign and select appropriate channels for the target audience' },
                ],
              },
            },
            {
              name: 'Hållbart Företagande',
              order: 5,
              objectives: {
                create: [
                  { text: 'Förstå företagens ansvar för hållbar utveckling och etiskt agerande i samhället' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can explain what CSR means and give examples of how companies implement it in practice' },
                  { text: 'Student can evaluate a business decision from environmental, social, and economic sustainability perspectives' },
                  { text: 'Student can apply an ethical framework to a realistic business dilemma and justify the decision' },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Seeded: Företagsekonomi 1 (Sweden)')
  } else {
    console.log('Already seeded: Företagsekonomi 1 (Sweden)')
  }

  // Wirtschaft und Unternehmensgründung — German Gymnasium Business curriculum, Grade 10
  // Source: German KMK / Gymnasium Wirtschaft/BWL curricula
  const wirtschaftDE = await prisma.curriculumTemplate.findFirst({
    where: { country: 'Germany', name: 'Wirtschaft und Unternehmensgründung' },
  })
  if (!wirtschaftDE) {
    await prisma.curriculumTemplate.create({
      data: {
        country: 'Germany',
        subject: 'Business',
        grade: 'Grade 10',
        name: 'Wirtschaft und Unternehmensgründung',
        language: 'German',
        targetAudience: 'Students aged 15–16',
        modules: {
          create: [
            {
              name: 'Wirtschaftliche Grundlagen',
              order: 0,
              objectives: {
                create: [
                  { text: 'Grundlegende wirtschaftliche Zusammenhänge und Unternehmensformen verstehen' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can compare business forms (Einzelunternehmen, GmbH, AG) by ownership, liability, and taxation' },
                  { text: 'Student can explain how markets function and how prices are determined by supply and demand' },
                  { text: 'Student can identify the main stakeholders of a business and describe their interests' },
                ],
              },
            },
            {
              name: 'Unternehmertum und Innovation',
              order: 1,
              objectives: {
                create: [
                  { text: 'Unternehmerisches Denken entwickeln und Geschäftsideen systematisch bewerten' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify a market opportunity and articulate a clear Alleinstellungsmerkmal (USP)' },
                  { text: 'Student can conduct a Stärken-Schwächen-Chancen-Risiken (SWOT) analysis for a business idea' },
                  { text: 'Student can outline the core sections of a Businessplan and explain the purpose of each' },
                ],
              },
            },
            {
              name: 'Unternehmensführung',
              order: 2,
              objectives: {
                create: [
                  { text: 'Grundlagen der Unternehmensführung und Organisationsstrukturen kennen und anwenden' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can draw and interpret an Organigramm and describe the responsibilities at each level' },
                  { text: 'Student can compare Führungsstile (autoritär, kooperativ, laissez-faire) and their suitability in different contexts' },
                  { text: 'Student can explain the key functions of a Human Resources department (Personalwesen)' },
                ],
              },
            },
            {
              name: 'Rechnungswesen und Finanzen',
              order: 3,
              objectives: {
                create: [
                  { text: 'Grundlegende Konzepte des betrieblichen Rechnungswesens und der Finanzplanung verstehen' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can create a basic Kostenplan and distinguish between fixe and variable Kosten' },
                  { text: 'Student can read a simplified Gewinn-und-Verlust-Rechnung and identify Umsatz, Kosten, and Gewinn' },
                  { text: 'Student can explain the difference between Liquidität and Rentabilität and why both matter for a business' },
                ],
              },
            },
            {
              name: 'Marketing und Vertrieb',
              order: 4,
              objectives: {
                create: [
                  { text: 'Marketingstrategien entwickeln und auf konkrete Unternehmensszenarien anwenden' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can define a Zielgruppe and describe its characteristics using demographic and psychographic criteria' },
                  { text: 'Student can apply the marketing mix (Produkt, Preis, Distribution, Kommunikation) to a product or service' },
                  { text: 'Student can design a simple Marketingkampagne and justify the choice of channels for the target audience' },
                ],
              },
            },
            {
              name: 'Wirtschaft und Gesellschaft',
              order: 5,
              objectives: {
                create: [
                  { text: 'Die gesellschaftliche Verantwortung von Unternehmen und die Bedeutung nachhaltigen Wirtschaftens verstehen' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can explain the concept of Corporate Social Responsibility (CSR) and provide concrete examples' },
                  { text: 'Student can evaluate a business decision from ecological, social, and economic sustainability perspectives' },
                  { text: 'Student can apply ethical principles to a business dilemma and justify their reasoning' },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Seeded: Wirtschaft und Unternehmensgründung (Germany)')
  } else {
    console.log('Already seeded: Wirtschaft und Unternehmensgründung (Germany)')
  }

  // Sciences de gestion et numérique — French Seconde Business curriculum, Grade 10
  // Source: Ministère de l'Éducation nationale (education.gouv.fr)
  const sciencesGestionFR = await prisma.curriculumTemplate.findFirst({
    where: { country: 'France', name: 'Sciences de gestion et numérique' },
  })
  if (!sciencesGestionFR) {
    await prisma.curriculumTemplate.create({
      data: {
        country: 'France',
        subject: 'Business',
        grade: 'Grade 10',
        name: 'Sciences de gestion et numérique',
        language: 'French',
        targetAudience: 'Students aged 15–16',
        modules: {
          create: [
            {
              name: 'Organisation et Entreprise',
              order: 0,
              objectives: {
                create: [
                  { text: 'Comprendre la diversité des formes d\'organisation et leur fonctionnement' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can compare different types of organisations (entreprise, association, organisation publique) by purpose and structure' },
                  { text: 'Student can describe the main functions within an organisation (production, RH, finance, marketing)' },
                  { text: 'Student can read and interpret a simple organigramme' },
                ],
              },
            },
            {
              name: 'Entrepreneuriat',
              order: 1,
              objectives: {
                create: [
                  { text: 'Comprendre le processus de création d\'entreprise et développer un projet entrepreneurial' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify a market opportunity and articulate a clear valeur ajoutée for a business idea' },
                  { text: 'Student can conduct a basic étude de marché covering demand, competition, and positioning' },
                  { text: 'Student can outline the key sections of a business plan and explain what each section must demonstrate' },
                ],
              },
            },
            {
              name: 'Transformation Numérique',
              order: 2,
              objectives: {
                create: [
                  { text: 'Comprendre comment le numérique transforme les organisations et leurs pratiques de gestion' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can explain how digital tools (ERP, CRM, e-commerce) change the way organisations operate' },
                  { text: 'Student can describe the risks associated with data management (RGPD, cybersécurité) and how organisations mitigate them' },
                  { text: 'Student can use a spreadsheet to model a simple business scenario and interpret the results' },
                ],
              },
            },
            {
              name: 'Finance et Comptabilité',
              order: 3,
              objectives: {
                create: [
                  { text: 'Comprendre comment les organisations suivent et analysent leur situation financière' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can create a simple budget prévisionnel and distinguish between charges fixes and charges variables' },
                  { text: 'Student can read a basic compte de résultat and identify chiffre d\'affaires, charges, and résultat net' },
                  { text: 'Student can explain the difference between trésorerie and rentabilité and why both matter for business survival' },
                ],
              },
            },
            {
              name: 'Management et Décision',
              order: 4,
              objectives: {
                create: [
                  { text: 'Comprendre comment les managers prennent des décisions et pilotent les équipes' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can distinguish between strategic, tactical, and operational decisions with real examples' },
                  { text: 'Student can compare styles de management (autoritaire, participatif, délégatif) and explain when each is appropriate' },
                  { text: 'Student can describe motivation theories (Maslow, Herzberg) and apply them to a workplace scenario' },
                ],
              },
            },
            {
              name: 'Droit et Responsabilité',
              order: 5,
              objectives: {
                create: [
                  { text: 'Comprendre le cadre juridique et éthique dans lequel les organisations exercent leurs activités' },
                ],
              },
              outcomes: {
                create: [
                  { text: 'Student can identify the elements of a valid contrat commercial and explain what makes it binding' },
                  { text: 'Student can describe employer obligations under French droit du travail (contrat, congés, SMIC)' },
                  { text: 'Student can apply an ethical decision-making framework to a realistic business dilemma and justify the outcome' },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Seeded: Sciences de gestion et numérique (France)')
  } else {
    console.log('Already seeded: Sciences de gestion et numérique (France)')
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
