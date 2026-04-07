import { describe, it, expect } from 'vitest'
import { buildPrompt } from './wizard'

describe('buildPrompt()', () => {
  it('returns null for an unknown field', () => {
    expect(buildPrompt('unknown', {})).toBeNull()
  })

  it('name prompt mentions language when provided', () => {
    const prompt = buildPrompt('name', { language: 'Swedish' })
    expect(prompt).not.toBeNull()
    expect(prompt).toContain('Swedish')
  })

  it('name prompt works without language', () => {
    expect(buildPrompt('name', {})).not.toBeNull()
  })

  it('subject prompt mentions course name', () => {
    const prompt = buildPrompt('subject', { name: 'Algebra Basics' })
    expect(prompt).toContain('Algebra Basics')
  })

  it('targetAudience prompt mentions name and subject', () => {
    const prompt = buildPrompt('targetAudience', { name: 'Algebra', subject: 'Mathematics' })
    expect(prompt).toContain('Algebra')
    expect(prompt).toContain('Mathematics')
  })

  it('module.name prompt lists existing modules', () => {
    const prompt = buildPrompt('module.name', {
      name: 'Algebra',
      subject: 'Math',
      targetAudience: 'Year 9',
      existingModuleNames: ['Variables', 'Equations'],
    })
    expect(prompt).toContain('Variables')
    expect(prompt).toContain('Equations')
  })

  it('module.objective prompt contains module name', () => {
    const prompt = buildPrompt('module.objective', {
      name: 'Algebra',
      subject: 'Math',
      moduleName: 'Variables & Expressions',
    })
    expect(prompt).toContain('Variables & Expressions')
  })

  it('module.outcome prompt lists existing objectives', () => {
    const prompt = buildPrompt('module.outcome', {
      name: 'Algebra',
      subject: 'Math',
      moduleName: 'Variables',
      existingObjectives: ['Understand what a variable is'],
    })
    expect(prompt).toContain('Understand what a variable is')
  })
})
