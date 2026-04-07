import { describe, it, expect } from 'vitest'
import { buildObjectivesData, buildOutcomesData } from './courses'

const wizardModules = [
  {
    order: 0,
    objectives: [{ text: 'Understand vectors' }, { text: 'Add vectors' }],
    outcomes:   [{ text: 'Solve vector problems' }],
  },
  {
    order: 1,
    objectives: [{ text: 'Multiply matrices' }],
    outcomes:   [{ text: 'Apply matrix ops' }, { text: 'Invert a matrix' }],
  },
]

const dbModules = [
  { id: 101, order: 0 },
  { id: 102, order: 1 },
]

describe('buildObjectivesData()', () => {
  it('flattens objectives from all modules with correct courseModuleId', () => {
    const result = buildObjectivesData(wizardModules, dbModules)
    expect(result).toEqual([
      { text: 'Understand vectors', courseModuleId: 101 },
      { text: 'Add vectors',        courseModuleId: 101 },
      { text: 'Multiply matrices',  courseModuleId: 102 },
    ])
  })

  it('returns an empty array when modules list is empty', () => {
    expect(buildObjectivesData([], [])).toEqual([])
  })

  it('skips a module if its order has no matching DB row', () => {
    const partial = [{ id: 101, order: 0 }] // order 1 is missing
    const result = buildObjectivesData(wizardModules, partial)
    expect(result).toEqual([
      { text: 'Understand vectors', courseModuleId: 101 },
      { text: 'Add vectors',        courseModuleId: 101 },
    ])
  })

  it('produces no rows for a module with an empty objectives array', () => {
    const result = buildObjectivesData(
      [{ order: 0, objectives: [] }],
      [{ id: 101, order: 0 }],
    )
    expect(result).toEqual([])
  })
})



describe('buildOutcomesData()', () => {
  it('flattens outcomes from all modules with correct courseModuleId', () => {
    const result = buildOutcomesData(wizardModules, dbModules)
    expect(result).toEqual([
      { text: 'Solve vector problems', courseModuleId: 101 },
      { text: 'Apply matrix ops',      courseModuleId: 102 },
      { text: 'Invert a matrix',       courseModuleId: 102 },
    ])
  })

  it('returns an empty array when modules list is empty', () => {
    expect(buildOutcomesData([], [])).toEqual([])
  })

  it('skips a module if its order has no matching DB row', () => {
    const partial = [{ id: 101, order: 0 }]
    const result = buildOutcomesData(wizardModules, partial)
    expect(result).toEqual([
      { text: 'Solve vector problems', courseModuleId: 101 },
    ])
  })

  it('produces no rows for a module with an empty outcomes array', () => {
    const result = buildOutcomesData(
      [{ order: 0, outcomes: [] }],
      [{ id: 101, order: 0 }],
    )
    expect(result).toEqual([])
  })
})
