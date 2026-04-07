'use client'

import { useState } from 'react'
import { Dialog } from 'radix-ui'
import VisualizationRenderer from '@/components/visualizations/VisualizationRenderer'

interface VizChipProps {
  templateId: string
  params: Record<string, unknown>
  targetState?: Record<string, unknown>
}

export function VizChip({ templateId, params, targetState }: VizChipProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors border border-indigo-100"
      >
        <span>⬡</span>
        <span className="font-mono">{templateId}</span>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-xl w-[540px] max-h-[85vh] overflow-auto p-6 focus:outline-none">
            <Dialog.Title className="text-sm font-semibold text-gray-700 mb-4">
              Visualization ·{' '}
              <span className="font-mono text-indigo-600">{templateId}</span>
            </Dialog.Title>

            <VisualizationRenderer templateId={templateId} params={params} />

            {targetState && (
              <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Target state
                </p>
                <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(targetState, null, 2)}
                </pre>
              </div>
            )}

            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors text-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
