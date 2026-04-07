import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { RichMessage } from '@metis/types'

// Capture the onImageClick callback passed to ImageNode.configure
let capturedOnImageClick: ((url: string) => void) | undefined

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => null),
  EditorContent: () => <div data-testid="editor-content" />,
}))
// vi.hoisted ensures the variable is available when vi.mock is hoisted to the top
const { mathNodeConfigure } = vi.hoisted(() => ({ mathNodeConfigure: vi.fn(() => ({})) }))
vi.mock('./extensions/MathNode', () => ({ MathNode: { configure: mathNodeConfigure } }))
vi.mock('./extensions/ImageNode', () => ({
  ImageNode: {
    configure: vi.fn((opts: any) => {
      capturedOnImageClick = opts.onImageClick
      return {}
    })
  }
}))

import { RichMessageRenderer } from './RichMessageRenderer'

const sampleRichContent: RichMessage['richContent'] = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
}

describe('RichMessageRenderer', () => {
  beforeEach(() => {
    capturedOnImageClick = undefined
  })

  it('renders EditorContent', () => {
    render(<RichMessageRenderer richContent={sampleRichContent} />)
    expect(screen.getByTestId('editor-content')).toBeInTheDocument()
  })

  it('configures MathNode with onEditMath: undefined (no edit interaction)', () => {
    render(<RichMessageRenderer richContent={sampleRichContent} />)
    expect(mathNodeConfigure).toHaveBeenCalledWith({ onEditMath: undefined })
  })

  it('does not show lightbox initially', () => {
    render(<RichMessageRenderer richContent={sampleRichContent} />)
    expect(screen.queryByAltText('Attached image')).toBeNull()
  })

  it('opens lightbox when onImageClick is triggered', async () => {
    render(<RichMessageRenderer richContent={sampleRichContent} />)

    // capturedOnImageClick is set during useEditor call inside RichMessageRenderer
    // Trigger the lightbox by calling the captured callback
    await act(async () => {
      capturedOnImageClick?.('https://example.com/img.png')
    })

    const img = screen.getByAltText('Attached image') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.src).toBe('https://example.com/img.png')
  })
})
