'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ResponsiveContainer,
  useXAxisScale, useYAxisScale, useXAxisDomain,
  useActiveTooltipCoordinate, useActiveTooltipDataPoints,
} from 'recharts'
import { Slider } from '../shared/Slider'
import type { VisualizationTemplateProps } from '../shared/types'

export type CartesianGraphParams = {
  mode: 'linear' | 'quadratic' | 'sinusoidal'
  slope?: number; intercept?: number
  a?: number; b?: number; c?: number
  amplitude?: number; frequency?: number; phase?: number
  xMin?: number; xMax?: number
}

export type CartesianGraphState = Record<string, number>

function fmt(n: number, decimals = 2): string {
  return parseFloat(n.toFixed(decimals)).toString()
}

function buildFormula(mode: string, s: Record<string, number>): string {
  if (mode === 'linear') {
    const m = s.slope, b = s.intercept
    const slopePart = m === 1 ? 'x' : m === -1 ? '-x' : `${fmt(m)}x`
    const interceptPart = b === 0 ? '' : b > 0 ? ` + ${fmt(b)}` : ` - ${fmt(Math.abs(b))}`
    return `f(x) = ${slopePart}${interceptPart}`
  }
  if (mode === 'quadratic') {
    const a = s.a, b = s.b, c = s.c
    const aPart = a === 1 ? 'x²' : a === -1 ? '-x²' : `${fmt(a)}x²`
    const bPart = b === 0 ? '' : b > 0 ? ` + ${fmt(b)}x` : ` - ${fmt(Math.abs(b))}x`
    const cPart = c === 0 ? '' : c > 0 ? ` + ${fmt(c)}` : ` - ${fmt(Math.abs(c))}`
    return `f(x) = ${aPart}${bPart}${cPart}`
  }
  // sinusoidal
  const A = s.amplitude, ω = s.frequency, φ = s.phase
  const phasePart = φ === 0 ? '' : φ > 0 ? ` + ${fmt(φ)}` : ` - ${fmt(Math.abs(φ))}`
  return `f(x) = ${fmt(A)}·sin(${fmt(ω)}x${phasePart})`
}

function computeY(mode: string, x: number, s: Record<string, number>): number {
  if (mode === 'linear')    return s.slope * x + s.intercept
  if (mode === 'quadratic') return s.a * x ** 2 + s.b * x + s.c
  return s.amplitude * Math.sin(s.frequency * x + s.phase)
}

function buildData(mode: string, s: Record<string, number>, xMin: number, xMax: number) {
  return Array.from({ length: 201 }, (_, i) => {
    const x = xMin + (i / 200) * (xMax - xMin)
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(computeY(mode, x, s).toFixed(4)) }
  })
}

const SLIDER_CONFIG: Record<string, { key: string; label: string; min: number; max: number; step: number }[]> = {
  linear:     [{ key: 'slope', label: 'Slope', min: -5, max: 5, step: 0.1 }, { key: 'intercept', label: 'Intercept', min: -10, max: 10, step: 0.5 }],
  quadratic:  [{ key: 'a', label: 'a', min: -3, max: 3, step: 0.1 }, { key: 'b', label: 'b', min: -5, max: 5, step: 0.5 }, { key: 'c', label: 'c', min: -10, max: 10, step: 0.5 }],
  sinusoidal: [{ key: 'amplitude', label: 'Amplitude', min: 0, max: 5, step: 0.1 }, { key: 'frequency', label: 'Frequency', min: 0.1, max: 5, step: 0.1 }, { key: 'phase', label: 'Phase', min: -3.14, max: 3.14, step: 0.05 }],
}

function initState(params: CartesianGraphParams): Record<string, number> {
  const { mode } = params
  if (mode === 'linear')    return { slope: params.slope ?? 1, intercept: params.intercept ?? 0 }
  if (mode === 'quadratic') return { a: params.a ?? 1, b: params.b ?? 0, c: params.c ?? 0 }
  return { amplitude: params.amplitude ?? 1, frequency: params.frequency ?? 1, phase: params.phase ?? 0 }
}

// ---------------------------------------------------------------------------
// Crosshair overlay — rendered as a direct child of <LineChart>.
// Uses Recharts 3.x hooks to read axis scales and active tooltip state
// from the chart's internal Redux store — no prop-drilling needed.
// ---------------------------------------------------------------------------

function CrosshairOverlay() {
  const coordinate  = useActiveTooltipCoordinate()
  const dataPoints  = useActiveTooltipDataPoints()
  const xScale      = useXAxisScale()
  const yScale      = useYAxisScale()
  const xDomain     = useXAxisDomain()

  if (!coordinate || !dataPoints?.[0] || !xScale || !yScale) return null

  // useActiveTooltipDataPoints returns the raw data objects ({ x, y }) not tooltip entries.
  // coordinate.x = SVG x of the snapped position; coordinate.y = cursor y (not curve y).
  const svgX  = coordinate.x
  const domX: number = (dataPoints[0]?.x as number) ?? 0
  const domY: number = (dataPoints[0]?.y as number) ?? 0
  const svgY  = yScale(domY)

  // SVG position of the axis lines (where domain value 0 maps to)
  const axisX = xScale(0)
  const axisY = yScale(0)

  const labelStr = `(${domX.toFixed(2)}, ${domY.toFixed(2)})`
  const tw = labelStr.length * 6.5 + 16
  const th = 20
  const gap = 10
  // Flip label left if it would overflow the right plot edge
  // useXAxisScale returns the raw mapping fn, not a d3 scale — use useXAxisDomain for bounds
  const rightEdge = xDomain ? xScale(xDomain[1] as number) : svgX + 999
  const lx = svgX + gap + tw > rightEdge ? svgX - gap - tw : svgX + gap
  const ly = svgY - th / 2

  return (
    <g pointerEvents="none">
      {/* Vertical dashed line: dot → x-axis */}
      <line x1={svgX} y1={svgY} x2={svgX} y2={axisY}
        stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" opacity={0.45} />
      {/* Horizontal dashed line: y-axis → dot */}
      <line x1={axisX} y1={svgY} x2={svgX} y2={svgY}
        stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" opacity={0.45} />
      {/* Tick mark on x-axis */}
      <line x1={svgX} y1={axisY - 4} x2={svgX} y2={axisY + 4}
        stroke="#6366f1" strokeWidth={2} strokeLinecap="round" />
      {/* Tick mark on y-axis */}
      <line x1={axisX - 4} y1={svgY} x2={axisX + 4} y2={svgY}
        stroke="#6366f1" strokeWidth={2} strokeLinecap="round" />
      {/* Dot on the curve */}
      <circle cx={svgX} cy={svgY} r={5} fill="#6366f1" stroke="white" strokeWidth={2} />
      {/* Label pill */}
      <rect x={lx} y={ly} width={tw} height={th} rx={5} fill="#1a1a1a" />
      <text x={lx + 8} y={svgY} dominantBaseline="central"
        fontFamily="monospace" fontSize={10.5} fontWeight="500" fill="white">
        {labelStr}
      </text>
    </g>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CartesianGraph({
  params, targetState, onStateChange,
}: VisualizationTemplateProps<CartesianGraphParams, CartesianGraphState>) {
  const { mode, xMin = -10, xMax = 10 } = params
  const [state, setState] = useState<Record<string, number>>(() => initState(params))

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.(state) }, [state])

  const data = buildData(mode, state, xMin, xMax)
  const targetData = targetState ? buildData(mode, targetState as Record<string, number>, xMin, xMax) : null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis type="number" dataKey="x" domain={[xMin, xMax]} tickCount={5} stroke="#9ca3af" tick={{ fontSize: 10 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
          <ReferenceLine x={0} stroke="#e5e7eb" />
          <ReferenceLine y={0} stroke="#e5e7eb" />
          <Line data={data} type="monotone" dataKey="y" stroke="#6366f1" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
          {targetData && (
            <Line data={targetData} type="monotone" dataKey="y" stroke="#6366f1" dot={false} activeDot={false} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.4} isAnimationActive={false} />
          )}
          <CrosshairOverlay />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 mb-1 text-center font-mono text-sm text-indigo-700 bg-indigo-50 rounded-md py-1.5 px-3">
        {buildFormula(mode, state)}
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {SLIDER_CONFIG[mode].map(s => (
          <Slider
            key={s.key}
            label={s.label}
            value={state[s.key]}
            min={s.min}
            max={s.max}
            step={s.step}
            onChange={v => setState(prev => ({ ...prev, [s.key]: v }))}
          />
        ))}
      </div>
    </div>
  )
}
