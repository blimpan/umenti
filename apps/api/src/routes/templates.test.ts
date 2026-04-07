import { describe, it, expect } from 'vitest'
import { buildMetaResponse } from './templates'

describe('buildMetaResponse()', () => {
  it('returns empty array for no templates', () => {
    expect(buildMetaResponse([])).toEqual([])
  })

  it('groups templates by country and subject', () => {
    const input = [
      { id: 1, country: 'Sweden', subject: 'Mathematics', grade: 'Grade 10', name: 'Matematik 2b' },
      { id: 2, country: 'Sweden', subject: 'Mathematics', grade: 'Grade 10', name: 'Matematik 2c' },
      { id: 3, country: 'Sweden', subject: 'Swedish', grade: 'Grade 10', name: 'Svenska 2' },
    ]
    const result = buildMetaResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0].country).toBe('Sweden')
    expect(result[0].subjects).toHaveLength(2)
    const math = result[0].subjects.find(s => s.subject === 'Mathematics')!
    expect(math.templates).toHaveLength(2)
    expect(math.templates.map(t => t.id)).toEqual(expect.arrayContaining([1, 2]))
  })

  it('handles multiple countries', () => {
    const input = [
      { id: 1, country: 'Sweden', subject: 'Mathematics', grade: 'Grade 10', name: 'Matematik 2b' },
      { id: 2, country: 'Norway', subject: 'Mathematics', grade: 'Grade 10', name: 'Matematikk 2' },
    ]
    const result = buildMetaResponse(input)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.country)).toEqual(expect.arrayContaining(['Sweden', 'Norway']))
  })

  it('preserves id, name and grade on each template entry', () => {
    const input = [
      { id: 7, country: 'Sweden', subject: 'Mathematics', grade: 'Grade 11', name: 'Matematik 3c' },
    ]
    const result = buildMetaResponse(input)
    const template = result[0].subjects[0].templates[0]
    expect(template).toEqual({ id: 7, name: 'Matematik 3c', grade: 'Grade 11' })
  })
})
