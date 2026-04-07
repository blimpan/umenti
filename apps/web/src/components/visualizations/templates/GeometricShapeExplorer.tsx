'use client'

import { useState, useEffect } from 'react'
import { Slider } from '../shared/Slider'
import type { VisualizationTemplateProps } from '../shared/types'

function NumericInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState(String(value))
  return (
    <div className="flex items-center gap-3">
      <label className="w-16 text-[11px] text-gray-500 shrink-0">{label}</label>
      <input
        type="number"
        min={0}
        step="any"
        value={raw}
        onChange={e => {
          setRaw(e.target.value)
          const n = parseFloat(e.target.value)
          if (!isNaN(n) && n > 0) onChange(n)
        }}
        className="w-28 rounded border border-gray-200 px-2 py-1 text-sm tabular-nums focus:border-indigo-400 focus:outline-none"
      />
    </div>
  )
}

export type GeometricShapeParams = {
  shape: 'rectangle' | 'circle' | 'right_triangle'
  width?: number; height?: number
  radius?: number
  base?: number; legHeight?: number
  showArea?: boolean
  showPerimeter?: boolean
}

export type GeometricShapeState = Record<string, number>

const SVG_W = 260, SVG_H = 160, MAX_SCALE = 16, PAD = 16

function fmt2(n: number) { return parseFloat(n.toFixed(2)) }

export default function GeometricShapeExplorer({
  params, targetState, onStateChange,
}: VisualizationTemplateProps<GeometricShapeParams, GeometricShapeState>) {
  const isExercise = !!onStateChange
  const { shape, showArea = true, showPerimeter = true } = params
  const [width, setWidth]   = useState(params.width ?? 5)
  const [height, setHeight] = useState(params.height ?? 3)
  const [radius, setRadius] = useState(params.radius ?? 4)
  const [base, setBase]     = useState(params.base ?? 6)
  const [legH, setLegH]     = useState(params.legHeight ?? 4)

  const currentState: Record<string, number> =
    shape === 'rectangle'    ? { width: fmt2(width), height: fmt2(height) } :
    shape === 'circle'       ? { radius: fmt2(radius) } :
    /* right_triangle */       { base: fmt2(base), legHeight: fmt2(legH) }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.(currentState) }, [width, height, radius, base, legH])

  // Computed labels
  let areaLabel = '', perimLabel = ''
  const cx = SVG_W / 2, cy = SVG_H / 2
  if (shape === 'rectangle') {
    areaLabel  = `A = ${fmt2(width * height)}`
    perimLabel = `P = ${fmt2(2 * (width + height))}`
  } else if (shape === 'circle') {
    areaLabel  = `A = πr² = ${fmt2(Math.PI * radius ** 2)}`
    perimLabel = `C = 2πr = ${fmt2(2 * Math.PI * radius)}`
  } else {
    const hyp = Math.sqrt(base ** 2 + legH ** 2)
    areaLabel  = `A = ½bh = ${fmt2(0.5 * base * legH)}`
    perimLabel = `P = ${fmt2(base + legH + hyp)}`
  }

  const ts = targetState as Record<string, number> | undefined

  // Compute adaptive scale: use the largest dimensions present (current + target)
  // so neither shape overflows the viewBox, while still being as large as possible.
  let scale = MAX_SCALE
  if (shape === 'rectangle') {
    const maxW = Math.max(width, ts?.width ?? 0)
    const maxH = Math.max(height, ts?.height ?? 0)
    scale = Math.min(MAX_SCALE, (SVG_W - PAD) / maxW, (SVG_H - PAD) / maxH)
  } else if (shape === 'circle') {
    const maxR = Math.max(radius, ts?.radius ?? 0)
    scale = Math.min(MAX_SCALE, (SVG_H / 2 - PAD / 2) / maxR)
  } else {
    const maxB = Math.max(base, ts?.base ?? 0)
    const maxH = Math.max(legH, ts?.legHeight ?? 0)
    scale = Math.min(MAX_SCALE, (SVG_W - PAD) / maxB, (SVG_H - PAD) / maxH)
  }

  // SVG shape (active)
  let shapeEl: React.ReactNode
  let targetEl: React.ReactNode = null

  if (shape === 'rectangle') {
    const sw = width * scale, sh = height * scale
    shapeEl = <rect x={cx - sw/2} y={cy - sh/2} width={sw} height={sh} fill="#bae6fd" stroke="#0ea5e9" strokeWidth={2} rx={1} />
    if (ts) {
      const tw = (ts.width ?? width) * scale, th = (ts.height ?? height) * scale
      targetEl = <rect x={cx - tw/2} y={cy - th/2} width={tw} height={th} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} />
    }
  } else if (shape === 'circle') {
    const sr = radius * scale
    shapeEl = <circle cx={cx} cy={cy} r={sr} fill="#bae6fd" stroke="#0ea5e9" strokeWidth={2} />
    if (ts) {
      const tr = (ts.radius ?? radius) * scale
      targetEl = <circle cx={cx} cy={cy} r={tr} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} />
    }
  } else {
    const sb = base * scale, sh = legH * scale
    const pts = `${cx - sb/2},${cy + sh/2} ${cx + sb/2},${cy + sh/2} ${cx - sb/2},${cy - sh/2}`
    shapeEl = <polygon points={pts} fill="#bae6fd" stroke="#0ea5e9" strokeWidth={2} />
    if (ts) {
      const tb = (ts.base ?? base) * scale, th = (ts.legHeight ?? legH) * scale
      const tpts = `${cx - tb/2},${cy + th/2} ${cx + tb/2},${cy + th/2} ${cx - tb/2},${cy - th/2}`
      targetEl = <polygon points={tpts} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} />
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="mb-3">
        {targetEl}
        {shapeEl}
      </svg>
      <div className="flex flex-col gap-2.5">
        {shape === 'rectangle' && (isExercise ? (
          <>
            <NumericInput label="Width"  value={width}  onChange={setWidth} />
            <NumericInput label="Height" value={height} onChange={setHeight} />
          </>
        ) : (
          <>
            <Slider label="Width" value={width} min={0.5} max={10} step={0.1} onChange={setWidth} />
            <Slider label="Height" value={height} min={0.5} max={8} step={0.1} onChange={setHeight} />
          </>
        ))}
        {shape === 'circle' && (isExercise ? (
          <NumericInput label="Radius" value={radius} onChange={setRadius} />
        ) : (
          <Slider label="Radius" value={radius} min={0.5} max={7} step={0.1} onChange={setRadius} />
        ))}
        {shape === 'right_triangle' && (isExercise ? (
          <>
            <NumericInput label="Base"   value={base} onChange={setBase} />
            <NumericInput label="Height" value={legH} onChange={setLegH} />
          </>
        ) : (
          <>
            <Slider label="Base" value={base} min={0.5} max={10} step={0.1} onChange={setBase} />
            <Slider label="Height" value={legH} min={0.5} max={8} step={0.1} onChange={setLegH} />
          </>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-[11px] text-gray-500">
        {showArea && <span>{areaLabel}</span>}
        {showPerimeter && <span>{perimLabel}</span>}
      </div>
    </div>
  )
}
