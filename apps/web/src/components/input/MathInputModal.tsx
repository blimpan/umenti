'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { MathChip } from './MathChip'

interface MathInputModalProps {
  open: boolean
  initialLatex?: string
  isEditing?: boolean
  onInsert: (latex: string) => void
  onClose: () => void
}

type Tab = 'visual' | 'latex'

const MODAL_W = 480

export function MathInputModal({ open, initialLatex = '', isEditing = false, onInsert, onClose }: MathInputModalProps) {
  const [tab, setTab]     = useState<Tab>('visual')
  const [latex, setLatex] = useState(initialLatex)
  const mathFieldRef      = useRef<HTMLElement & { value?: string }>(null)
  const prevOpenRef       = useRef(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const isDragging  = useRef(false)
  const dragStart   = useRef({ px: 0, py: 0, ox: 0, oy: 0 })

  // Reset state only on false → true open transition
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setLatex(initialLatex)
      setTab('visual')
      setPosition({
        x: Math.round((window.innerWidth - MODAL_W) / 2),
        y: 72,
      })
    }
    prevOpenRef.current = open
  }, [open, initialLatex])

  // Load MathLive dynamically (web component; must run client-side only)
  useEffect(() => {
    import('mathlive').then(({ MathfieldElement }) => {
      // Disable keypress sounds — the .wav files aren't served by Next.js
      MathfieldElement.keypressSound = null
      MathfieldElement.plonkSound   = null
    }).catch(() => console.warn('MathLive failed to load'))
  }, [])

  // Sync latex -> math-field value (runs when tab or latex changes)
  useEffect(() => {
    const el = mathFieldRef.current
    if (!el || tab !== 'visual') return
    if (el.value !== latex) el.value = latex
  }, [tab, latex])

  // Attach input listener once per tab switch or dialog open (setLatex is stable from useState)
  // Must include `open` because Radix Dialog only mounts <math-field> when open=true,
  // so mathFieldRef.current is null on initial mount and the listener would never attach.
  useEffect(() => {
    const el = mathFieldRef.current
    if (!el || tab !== 'visual') return
    function handleInput(e: Event) {
      setLatex((e.target as HTMLElement & { value?: string }).value ?? '')
    }
    el.addEventListener('input', handleInput)
    return () => el.removeEventListener('input', handleInput)
  }, [tab, open])

  function handleDragStart(e: React.PointerEvent<HTMLDivElement>) {
    // Ignore clicks that originate from tab buttons — let them pass through normally
    if ((e.target as HTMLElement).closest('button')) return
    isDragging.current = true
    dragStart.current = { px: e.clientX, py: e.clientY, ox: position.x, oy: position.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function handleDragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    const x = dragStart.current.ox + (e.clientX - dragStart.current.px)
    const y = dragStart.current.oy + (e.clientY - dragStart.current.py)
    setPosition({
      x: Math.max(0, Math.min(x, window.innerWidth - MODAL_W)),
      y: Math.max(0, Math.min(y, window.innerHeight - 50)),
    })
  }

  function handleDragEnd() {
    isDragging.current = false
  }

  function handleInsert() {
    const trimmed = latex.trim()
    if (!trimmed) return
    onInsert(trimmed)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-50" />
        <Dialog.Content
          style={{ left: position.x, top: position.y }}
          className="fixed z-50 bg-white rounded-xl shadow-xl w-[480px] max-w-[95vw] overflow-hidden"
          onInteractOutside={e => {
            // MathLive renders its virtual keyboard as a plain .ML__keyboard div appended to
            // document.body — outside Dialog.Content. Clicks there must not close the dialog.
            const keyboard = document.querySelector('.ML__keyboard')
            const target = (e as CustomEvent).detail?.originalEvent?.target as Node | null
            if (keyboard && target && keyboard.contains(target)) {
              e.preventDefault()
            }
          }}
          onFocusOutside={e => {
            const keyboard = document.querySelector('.ML__keyboard')
            const target = (e as CustomEvent).detail?.originalEvent?.target as Node | null
            if (keyboard && target && keyboard.contains(target)) {
              e.preventDefault()
            }
          }}
        >
          <Dialog.Title className="sr-only">{isEditing ? 'Edit math expression' : 'Insert math expression'}</Dialog.Title>

          {/* Tab bar — drag handle */}
          <div
            role="tablist"
            className="flex border-b border-gray-100 cursor-grab active:cursor-grabbing select-none"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            {(['visual', 'latex'] as Tab[]).map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'border-b-2 border-teal-600 text-teal-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'visual' ? 'Visual editor' : 'LaTeX'}
              </button>
            ))}
            {/* Drag hint icon — pointer-events-none so it doesn't block drag */}
            <span className="ml-auto px-3 flex items-center text-gray-500 pointer-events-none" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                {/* Vertical shaft */}
                <rect x="7.25" y="5" width="1.5" height="6"/>
                {/* Horizontal shaft */}
                <rect x="5" y="7.25" width="6" height="1.5"/>
                {/* Up arrowhead */}
                <polygon points="8,1 6,5 10,5"/>
                {/* Down arrowhead */}
                <polygon points="8,15 6,11 10,11"/>
                {/* Left arrowhead */}
                <polygon points="1,8 5,6 5,10"/>
                {/* Right arrowhead */}
                <polygon points="15,8 11,6 11,10"/>
              </svg>
            </span>
          </div>

          <div className="p-5">
            {tab === 'visual' ? (
              <div>
                <math-field
                  ref={mathFieldRef}
                  class="w-full min-h-[60px] border border-gray-200 rounded-lg p-3 text-lg focus:outline-none focus:border-teal-400"
                  virtual-keyboard-mode="manual"
                />
                <p className="mt-2 text-xs text-gray-400">
                  Type LaTeX directly, or use the on-screen keyboard.
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 block mb-1">LaTeX</label>
                  <textarea
                    value={latex}
                    onChange={e => setLatex(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-3 font-mono text-sm resize-none outline-none focus:border-teal-400"
                    rows={4}
                    placeholder="x^2 + 2x - 3"
                    autoFocus
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Preview</label>
                  <div className="border border-gray-200 rounded-lg p-3 min-h-[96px] flex items-center justify-center bg-gray-50">
                    {latex.trim()
                      ? <MathChip latex={latex} />
                      : <span className="text-xs text-gray-400">Preview appears here</span>
                    }
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleInsert}
                disabled={!latex.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-40"
              >
                {isEditing ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
