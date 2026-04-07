'use client'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[11px] text-gray-500">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{value.toFixed(step < 0.1 ? 3 : step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-indigo-500 cursor-pointer"
      />
    </div>
  )
}
