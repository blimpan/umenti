import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlusMenu } from './PlusMenu'

const defaultProps = {
  allowImages: true,
  uploading: false,
  onInsertMath: vi.fn(),
  onFileSelected: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlusMenu', () => {
  it('renders the + trigger button', () => {
    render(<PlusMenu {...defaultProps} />)
    expect(screen.getByRole('button', { name: /insert math or attach image/i })).toBeInTheDocument()
  })

  it('clicking the trigger opens the popover showing "Insert math expression"', async () => {
    const user = userEvent.setup()
    render(<PlusMenu {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /insert math or attach image/i }))

    expect(screen.getByText('Insert math expression')).toBeInTheDocument()
  })

  it('shows "Attach image" when allowImages is true', async () => {
    const user = userEvent.setup()
    render(<PlusMenu {...defaultProps} allowImages={true} />)

    await user.click(screen.getByRole('button', { name: /insert math or attach image/i }))

    expect(screen.getByText('Attach image')).toBeInTheDocument()
  })

  it('does NOT show "Attach image" when allowImages is false', async () => {
    const user = userEvent.setup()
    render(<PlusMenu {...defaultProps} allowImages={false} />)

    await user.click(screen.getByRole('button', { name: /insert math or attach image/i }))

    expect(screen.queryByText('Attach image')).not.toBeInTheDocument()
  })

  it('disables the trigger button when uploading is true', () => {
    render(<PlusMenu {...defaultProps} uploading={true} />)
    expect(screen.getByRole('button', { name: /insert math or attach image/i })).toBeDisabled()
  })

  it('clicking "Insert math expression" calls onInsertMath', async () => {
    const user = userEvent.setup()
    const onInsertMath = vi.fn()
    render(<PlusMenu {...defaultProps} onInsertMath={onInsertMath} />)

    await user.click(screen.getByRole('button', { name: /insert math or attach image/i }))
    await user.click(screen.getByText('Insert math expression'))

    expect(onInsertMath).toHaveBeenCalledTimes(1)
  })

  it('clicking "Attach image" triggers the hidden file input', async () => {
    const user = userEvent.setup()
    render(<PlusMenu {...defaultProps} allowImages={true} />)

    // Get the hidden file input and mock its click
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {})

    await user.click(screen.getByRole('button', { name: /insert math or attach image/i }))
    await user.click(screen.getByText('Attach image'))

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('selecting a file calls onFileSelected with that file', async () => {
    const onFileSelected = vi.fn()
    render(<PlusMenu {...defaultProps} onFileSelected={onFileSelected} />)

    const file = new File(['content'], 'photo.png', { type: 'image/png' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(fileInput, file)

    expect(onFileSelected).toHaveBeenCalledWith(file)
  })
})
