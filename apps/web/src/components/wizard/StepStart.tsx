'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  onNext: (useTemplate: boolean) => void
}

export default function StepStart({ onNext }: Props) {
  const [choice, setChoice] = useState<boolean | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">How do you want to start?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Start from an official curriculum or build your own structure from scratch.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setChoice(true)}
          className={`text-left rounded-xl border-2 p-5 transition-colors ${
            choice === true
              ? 'border-gray-900 bg-gray-50'
              : 'border-gray-200 hover:border-gray-400'
          }`}
        >
          <div className="text-2xl mb-3">📚</div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Use a curriculum template</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Start from your country's official course structure.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setChoice(false)}
          className={`text-left rounded-xl border-2 p-5 transition-colors ${
            choice === false
              ? 'border-gray-900 bg-gray-50'
              : 'border-gray-200 hover:border-gray-400'
          }`}
        >
          <div className="text-2xl mb-3">✏️</div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Build from scratch</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Define your own modules, objectives and outcomes.
          </p>
        </button>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => onNext(choice!)} disabled={choice === null}>
          Next
        </Button>
      </div>
    </div>
  )
}
