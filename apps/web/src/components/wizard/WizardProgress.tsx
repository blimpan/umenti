type Props = {
  steps: readonly string[]
  currentStep: number
}

export default function WizardProgress({ steps, currentStep }: Props) {
  return (
    <div className="flex items-start">
      {steps.map((label, i) => {
        const n = i + 1
        const isComplete = n < currentStep
        const isActive = n === currentStep

        return (
          <div key={label} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                ${isComplete ? 'bg-primary text-primary-foreground' : ''}
                ${isActive ? 'border-2 border-primary text-primary' : ''}
                ${!isComplete && !isActive ? 'border-2 border-gray-200 text-gray-400' : ''}`}
              >
                {isComplete ? '✓' : n}
              </div>
              <span className={`text-xs font-medium text-center ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mt-4 mx-2 transition-colors ${isComplete ? 'bg-primary' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
