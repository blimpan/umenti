import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import katex from 'katex'
import { MathChip } from './MathChip'

vi.mock('katex/dist/katex.min.css', () => ({}))
vi.mock('katex', () => ({ default: { render: vi.fn() } }))

describe('MathChip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without errors with a valid LaTeX string', () => {
    expect(() => render(<MathChip latex="x^2 + y^2 = z^2" />)).not.toThrow()
  })

  it('shows a remove button when onRemove is provided', () => {
    const onRemove = vi.fn()
    render(<MathChip latex="x^2" onRemove={onRemove} />)
    expect(screen.getByRole('button', { name: /remove math expression/i })).toBeInTheDocument()
  })

  it('does NOT show a remove button when onRemove is absent', () => {
    render(<MathChip latex="x^2" />)
    expect(screen.queryByRole('button', { name: /remove math expression/i })).not.toBeInTheDocument()
  })

  it('calls katex.render with the correct latex and options', () => {
    render(<MathChip latex="x^2 + y^2" />)
    expect(vi.mocked(katex.render)).toHaveBeenCalledWith(
      'x^2 + y^2',
      expect.any(HTMLElement),
      expect.objectContaining({ throwOnError: false, displayMode: false }),
    )
  })

  it('prevents default on mousedown and calls onRemove', () => {
    const onRemove = vi.fn()
    render(<MathChip latex="x^2" onRemove={onRemove} />)
    const button = screen.getByRole('button', { name: /remove math expression/i })
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    button.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
