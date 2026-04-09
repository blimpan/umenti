import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RichInput, extractAttachments } from './RichInput'

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => null),
  EditorContent: () => <div data-testid="editor-content" />,
  useEditorState: vi.fn(({ editor: e, selector }: { editor: any; selector: (arg: { editor: any }) => any }) =>
    selector({ editor: e })
  ),
}))
vi.mock('./extensions/MathNode', () => ({ MathNode: { configure: vi.fn(() => ({})) } }))
vi.mock('./extensions/ImageNode', () => ({ ImageNode: {} }))
vi.mock('./MathInputModal', () => ({
  MathInputModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="math-modal">
        <button data-testid="modal-close" onClick={onClose}>Close</button>
      </div>
    ) : null,
}))
vi.mock('./PlusMenu', () => ({
  PlusMenu: ({ onInsertMath, uploading, allowImages }: any) => (
    <div>
      <button onClick={onInsertMath} data-testid="insert-math-btn">Insert math</button>
      {uploading && <span data-testid="uploading" />}
      <span data-testid="allow-images">{String(allowImages)}</span>
    </div>
  ),
}))
vi.mock('@/lib/uploadImage', () => ({ uploadImage: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) }
  }))
}))

import { useEditor } from '@tiptap/react'

const helloDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] }

const mockEditor = {
  getJSON: vi.fn(() => helloDoc),
  getText: vi.fn(() => 'hello'),
  state: { selection: { anchor: 0 }, doc: { content: { size: 0 }, descendants: vi.fn() } },
  chain: vi.fn(() => ({
    focus: vi.fn(() => ({
      setTextSelection: vi.fn(() => ({
        insertContent: vi.fn(() => ({ run: vi.fn() }))
      }))
    }))
  })),
  commands: { clearContent: vi.fn() },
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: editor is null (no active editor)
  vi.mocked(useEditor).mockReturnValue(null as any)
})

describe('RichInput', () => {
  it('renders EditorContent and Send button', () => {
    render(<RichInput onSubmit={vi.fn()} />)
    expect(screen.getByTestId('editor-content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('Send button is disabled when editor is null (initial render)', () => {
    render(<RichInput onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('clicking insert math button opens the MathInputModal', async () => {
    // Need an editor for openMathModal to proceed
    vi.mocked(useEditor).mockReturnValue(mockEditor as any)
    const user = userEvent.setup()
    render(<RichInput onSubmit={vi.fn()} />)

    expect(screen.queryByTestId('math-modal')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('insert-math-btn'))
    expect(screen.getByTestId('math-modal')).toBeInTheDocument()
  })

  it('MathInputModal closes when onClose is called', async () => {
    vi.mocked(useEditor).mockReturnValue(mockEditor as any)
    const user = userEvent.setup()

    render(<RichInput onSubmit={vi.fn()} />)

    // Open the modal
    await user.click(screen.getByTestId('insert-math-btn'))
    expect(screen.getByTestId('math-modal')).toBeInTheDocument()

    // Close via the onClose callback exposed by the mock
    await user.click(screen.getByTestId('modal-close'))
    expect(screen.queryByTestId('math-modal')).not.toBeInTheDocument()
  })

  it('allowImages=false is passed to PlusMenu', () => {
    render(<RichInput onSubmit={vi.fn()} allowImages={false} />)
    expect(screen.getByTestId('allow-images')).toHaveTextContent('false')
  })

  it('allowImages=true (default) is passed to PlusMenu', () => {
    render(<RichInput onSubmit={vi.fn()} />)
    expect(screen.getByTestId('allow-images')).toHaveTextContent('true')
  })

  it('submit calls onSubmit with richContent, plainText, and empty attachments', () => {
    vi.mocked(useEditor).mockReturnValue(mockEditor as any)
    const onSubmit = vi.fn()
    render(<RichInput onSubmit={onSubmit} />)

    const sendBtn = screen.getByRole('button', { name: 'Send' })
    fireEvent.click(sendBtn)

    expect(onSubmit).toHaveBeenCalledWith({
      richContent: helloDoc,
      plainText: 'hello',
      attachments: [],
    })
    expect(mockEditor.commands.clearContent).toHaveBeenCalled()
  })

  it('submit does not call onSubmit when editor returns empty text', () => {
    vi.mocked(useEditor).mockReturnValue({
      ...mockEditor,
      getText: vi.fn(() => '   '),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
    } as any)
    const onSubmit = vi.fn()
    render(<RichInput onSubmit={onSubmit} />)

    // Button is disabled when text is empty/whitespace
    const sendBtn = screen.getByRole('button', { name: 'Send' })
    fireEvent.click(sendBtn)

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('extractAttachments', () => {
  it('returns empty array for a plain text document', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] }
    expect(extractAttachments(doc)).toEqual([])
  })

  it('finds a top-level attachment node', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'attachment', attrs: { url: 'https://example.com/img.png', filename: 'img.png' } }] }],
    }
    expect(extractAttachments(doc)).toEqual([{ url: 'https://example.com/img.png', filename: 'img.png' }])
  })

  it('finds attachments nested 3 levels deep (e.g. inside a list item)', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'attachment', attrs: { url: 'https://example.com/deep.png', filename: 'deep.png' } }],
          }],
        }],
      }],
    }
    expect(extractAttachments(doc)).toEqual([{ url: 'https://example.com/deep.png', filename: 'deep.png' }])
  })

  it('collects multiple attachments from different parts of the document', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'attachment', attrs: { url: 'https://a.com/1.png', filename: '1.png' } }] },
        { type: 'paragraph', content: [{ type: 'attachment', attrs: { url: 'https://a.com/2.png', filename: '2.png' } }] },
      ],
    }
    expect(extractAttachments(doc)).toEqual([
      { url: 'https://a.com/1.png', filename: '1.png' },
      { url: 'https://a.com/2.png', filename: '2.png' },
    ])
  })
})
