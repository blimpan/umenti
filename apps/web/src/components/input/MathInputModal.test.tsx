import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MathInputModal } from './MathInputModal'

vi.mock('mathlive', () => ({}))
vi.mock('./MathChip', () => ({
  MathChip: ({ latex }: { latex: string }) => <span data-testid="math-chip">{latex}</span>
}))

const defaultProps = {
  open: true,
  initialLatex: '',
  onInsert: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MathInputModal', () => {
  it('renders with the "Visual editor" tab active by default', () => {
    render(<MathInputModal {...defaultProps} />)
    const visualTab = screen.getByRole('tab', { name: 'Visual editor' })
    expect(visualTab).toBeInTheDocument()
    // Visual tab should have the active styling class
    expect(visualTab.className).toContain('border-b-2')
    // LaTeX tab should not have the active class
    const latexTab = screen.getByRole('tab', { name: 'LaTeX' })
    expect(latexTab.className).not.toContain('border-b-2')
  })

  it('switching to the LaTeX tab shows the textarea and preview', async () => {
    const user = userEvent.setup()
    render(<MathInputModal {...defaultProps} />)

    await user.click(screen.getByRole('tab', { name: 'LaTeX' }))

    expect(screen.getByPlaceholderText('x^2 + 2x - 3')).toBeInTheDocument()
    expect(screen.getByText('Preview appears here')).toBeInTheDocument()
  })

  it('typing in the LaTeX textarea updates the preview', async () => {
    const user = userEvent.setup()
    render(<MathInputModal {...defaultProps} />)

    await user.click(screen.getByRole('tab', { name: 'LaTeX' }))

    const textarea = screen.getByPlaceholderText('x^2 + 2x - 3')
    await user.type(textarea, 'x^2')

    expect(screen.getByTestId('math-chip')).toHaveTextContent('x^2')
  })

  it('Insert button is disabled when latex is empty', () => {
    render(<MathInputModal {...defaultProps} initialLatex="" />)
    const insertBtn = screen.getByRole('button', { name: 'Insert' })
    expect(insertBtn).toBeDisabled()
  })

  it('shows Update button label when isEditing is true', () => {
    render(<MathInputModal {...defaultProps} isEditing initialLatex="x^2" />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Insert' })).not.toBeInTheDocument()
  })

  it('Insert button is disabled when latex is whitespace only', async () => {
    const user = userEvent.setup()
    render(<MathInputModal {...defaultProps} />)

    await user.click(screen.getByRole('tab', { name: 'LaTeX' }))
    const textarea = screen.getByPlaceholderText('x^2 + 2x - 3')
    await user.type(textarea, '   ')

    const insertBtn = screen.getByRole('button', { name: 'Insert' })
    expect(insertBtn).toBeDisabled()
  })

  it('clicking Insert calls onInsert with trimmed latex and onClose', async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    const onClose = vi.fn()
    render(<MathInputModal {...defaultProps} onInsert={onInsert} onClose={onClose} />)

    await user.click(screen.getByRole('tab', { name: 'LaTeX' }))
    const textarea = screen.getByPlaceholderText('x^2 + 2x - 3')
    await user.type(textarea, '  x^2 + 1  ')

    await user.click(screen.getByRole('button', { name: 'Insert' }))

    expect(onInsert).toHaveBeenCalledWith('x^2 + 1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking Update calls onInsert and onClose when isEditing', async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    const onClose = vi.fn()
    render(<MathInputModal {...defaultProps} isEditing initialLatex="x^2" onInsert={onInsert} onClose={onClose} />)

    await user.click(screen.getByRole('tab', { name: 'LaTeX' }))
    const textarea = screen.getByPlaceholderText('x^2 + 2x - 3') as HTMLTextAreaElement
    await user.clear(textarea)
    await user.type(textarea, 'y^3')

    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(onInsert).toHaveBeenCalledWith('y^3')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking Cancel calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<MathInputModal {...defaultProps} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('tab bar has grab cursor class for drag affordance', () => {
    render(<MathInputModal {...defaultProps} />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.className).toContain('cursor-grab')
  })

  it('modal resets to visual tab and initialLatex when re-opened', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <MathInputModal {...defaultProps} open={true} initialLatex="x^2" />
    )

    // Switch to LaTeX tab
    await user.click(screen.getByRole('tab', { name: 'LaTeX' }))
    const textarea = screen.getByPlaceholderText('x^2 + 2x - 3')
    await user.clear(textarea)
    await user.type(textarea, 'y^3')

    // Close the modal
    rerender(<MathInputModal {...defaultProps} open={false} initialLatex="x^2" />)

    // Re-open
    rerender(<MathInputModal {...defaultProps} open={true} initialLatex="x^2" />)

    // Should be back on visual tab
    const visualTab = screen.getByRole('tab', { name: 'Visual editor' })
    expect(visualTab.className).toContain('border-b-2')

    // LaTeX tab should show the initialLatex value when switched to
    await user.click(screen.getByRole('tab', { name: 'LaTeX' }))
    const resetTextarea = screen.getByPlaceholderText('x^2 + 2x - 3') as HTMLTextAreaElement
    expect(resetTextarea.value).toBe('x^2')
  })
})
