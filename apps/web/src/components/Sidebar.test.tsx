import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from './Sidebar'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))
vi.mock('./LogoutButton', () => ({
  default: () => <button>Log out</button>,
}))

import { usePathname } from 'next/navigation'

describe('Sidebar', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
  })

  it('applies active classes to the current exact route', () => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
    render(<Sidebar role="STUDENT" userName="Linus Abc" />)
    const link = screen.getByRole('link', { name: /dashboard/i })
    expect(link.className).toContain('border-teal-600')
  })

  it('applies active classes to a nested child route', () => {
    vi.mocked(usePathname).mockReturnValue('/student/courses/42')
    render(<Sidebar role="STUDENT" userName="Linus Abc" />)
    const link = screen.getByRole('link', { name: /my courses/i })
    expect(link.className).toContain('border-teal-600')
  })

  it('does not apply active classes to non-current routes', () => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
    render(<Sidebar role="STUDENT" userName="Linus Abc" />)
    const link = screen.getByRole('link', { name: /my courses/i })
    expect(link.className).not.toContain('border-teal-600')
  })

  it('displays the first word of userName', () => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
    render(<Sidebar role="STUDENT" userName="Linus Abc" />)
    expect(screen.getByText('Linus')).toBeInTheDocument()
  })

  it('does not render Review or Notifications for TEACHER role', () => {
    vi.mocked(usePathname).mockReturnValue('/teacher/dashboard')
    render(<Sidebar role="TEACHER" userName="Ms Smith" />)
    expect(screen.queryByRole('link', { name: /review/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /notifications/i })).not.toBeInTheDocument()
  })

  it('shows single initial for a single-word name', () => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
    render(<Sidebar role="STUDENT" userName="Linus" />)
    expect(screen.getByText('L')).toBeInTheDocument()
  })

  it('shows fallback avatar character for an empty userName', () => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
    render(<Sidebar role="STUDENT" userName="" />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
