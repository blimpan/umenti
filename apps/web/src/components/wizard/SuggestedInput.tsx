'use client'

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/api'
import type { WizardSuggestContext, WizardSuggestResponse } from '@metis/types'

const API = process.env.NEXT_PUBLIC_API_URL

interface SuggestedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  field: string
  context: WizardSuggestContext
  onAccept: (value: string) => void
}

export default function SuggestedInput({
  field,
  context,
  onAccept,
  onFocus,
  onBlur,
  onChange,
  onKeyDown,
  className,
  ...props
}: SuggestedInputProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  async function fetchSuggestion() {
    try {
      const res = await apiFetch(`${API}/api/wizard/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, context }),
      })

      if (!res.ok) return
      const data: WizardSuggestResponse = await res.json()
      setSuggestion(data.suggestion)
    } catch {
      // Silent failure — teacher sees nothing, can type normally
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    onFocus?.(e)
    if (!e.target.value) {
      cancelTimer()
      timerRef.current = setTimeout(fetchSuggestion, 1000)
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    onBlur?.(e)
    cancelTimer()
    setSuggestion(null)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e)
    cancelTimer()
    setSuggestion(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault()
      onAccept(suggestion)
      setSuggestion(null)
      return
    }
    onKeyDown?.(e)
  }

  return (
    <div className={className ? `relative ${className}` : 'relative'}>
      <Input
        {...props}
        placeholder={suggestion ?? (props.placeholder as string | undefined)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {suggestion && (
        <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
          <kbd className="rounded border border-gray-300 bg-gray-100 px-1 font-mono text-[10px] text-gray-500">
            Tab
          </kbd>
          to accept
        </p>
      )}
    </div>
  )
}
