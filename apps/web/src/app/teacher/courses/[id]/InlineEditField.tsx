'use client'

import { useEffect, useRef, useState } from 'react'
import MathMarkdown from '@/components/MathMarkdown'

interface InlineEditFieldProps {
  value: string
  onSave: (newValue: string) => void
  multiline?: boolean
  markdown?: boolean
  placeholder?: string
  className?: string
}

export default function InlineEditField({
  value,
  onSave,
  multiline = false,
  markdown = false,
  placeholder,
  className = '',
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [committed, setCommitted] = useState(value)
  const [draft, setDraft] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync if parent passes a genuinely new value (e.g. after a page refetch)
  useEffect(() => { setCommitted(value) }, [value])

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [draft, isEditing])

  function startEditing() {
    setDraft(committed)
    setIsEditing(true)
  }

  function cancelEditing() {
    setDraft(committed)
    setIsEditing(false)
  }

  function saveEditing() {
    if (draft !== committed) {
      setCommitted(draft)
      onSave(draft)
    }
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    } else if (!multiline && e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  const baseClassName = `block w-full bg-transparent focus:outline-none cursor-text whitespace-pre-wrap ${className}`

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setDraft(e.target.value)
  }

  function handleBlur() {
    if (isEditing) {
      saveEditing()
    }
  }

  // Markdown display mode: show rendered markdown when not editing
  if (markdown && !isEditing) {
    return (
      <div
        onClick={startEditing}
        className={`md-content cursor-text min-h-[1.5rem] ${className}`}
      >
        {committed
          ? <MathMarkdown>{committed}</MathMarkdown>
          : <span className="text-gray-400">{placeholder}</span>
        }
      </div>
    )
  }

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        value={isEditing ? draft : committed}
        readOnly={!isEditing}
        placeholder={placeholder}
        onClick={() => { if (!isEditing) startEditing() }}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${baseClassName} resize-none overflow-hidden`}
        rows={1}
      />
    )
  }

  return (
    <input
      type="text"
      value={isEditing ? draft : committed}
      readOnly={!isEditing}
      placeholder={placeholder}
      onClick={() => { if (!isEditing) startEditing() }}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={baseClassName}
    />
  )
}
