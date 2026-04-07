'use client'

import katex from 'katex'
import { useEffect, useRef } from 'react'

interface MathChipProps {
  latex: string
  /** Shown in the TipTap editor — opens the edit modal on click */
  onClick?: () => void
  /** Shown in the TipTap editor — removes the node */
  onRemove?: () => void
}

export function MathChip({ latex, onClick, onRemove }: MathChipProps) {
  const mathRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!mathRef.current) return
    katex.render(latex || '\\square', mathRef.current, {
      throwOnError: false,
      displayMode:  false,
    })
  }, [latex])

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 bg-teal-50 border border-teal-200 rounded px-1.5 py-px text-teal-800 text-sm align-middle ${onClick ? 'cursor-pointer hover:bg-teal-100' : ''}`}
    >
      <span ref={mathRef} />
      {onRemove && (
        <button
          onMouseDown={e => { e.preventDefault(); onRemove() }}
          className="text-teal-300 hover:text-teal-500 leading-none ml-0.5 text-xs"
          aria-label="Remove math expression"
        >
          ×
        </button>
      )}
    </span>
  )
}
