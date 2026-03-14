'use client'

import { useEffect, useState } from 'react'

interface InlineEditFieldProps {
  value: string
  onSave: (newValue: string) => void
  multiline?: boolean
  placeholder?: string
  className?: string
}

export default function InlineEditField({
  value,
  onSave,
  multiline = false,
  placeholder,
  className = '',
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [committed, setCommitted] = useState(value)
  const [draft, setDraft] = useState(value)

  // Sync if parent passes a genuinely new value (e.g. after a page refetch)
  useEffect(() => { setCommitted(value) }, [value])

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

  const fieldValue = isEditing ? draft : committed
  const baseClassName = `block w-full bg-transparent focus:outline-none cursor-text whitespace-pre-wrap ${className}`

  function handleClick() {
    if (!isEditing) {
      startEditing()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setDraft(e.target.value)
  }

  function handleBlur() {
    if (isEditing) {
      saveEditing()
    }
  }

  if (multiline) {
    return (
      <textarea
        value={fieldValue}
        readOnly={!isEditing}
        placeholder={placeholder}
        onClick={handleClick}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${baseClassName} resize-none`}
        rows={1}
        style={{ fieldSizing: 'content' } as React.CSSProperties}
      />
    )
  }
  return (
    <input
      type="text"
      value={fieldValue}
      readOnly={!isEditing}
      placeholder={placeholder}
      onClick={handleClick}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={baseClassName}
    />
  )
}
