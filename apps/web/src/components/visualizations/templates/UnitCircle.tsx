'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { VisualizationTemplateProps } from '../shared/types'

export type UnitCircleParams = {
  initialAngle?: number      // degrees, default 45
  unit?: 'degrees' | 'radians'
  showComponents?: boolean   // sin/cos legs, default true
  showTan?: boolean          // default false
}

export type UnitCircleState = { angle: number } // always in degrees

const CX = 150, CY = 150, R = 110

function toRad(deg: number) { return (deg * Math.PI) / 180 }
function fmt(n: number) { return n.toFixed(3) }

export default function UnitCircle({
  params, targetState, onStateChange,
}: VisualizationTemplateProps<UnitCircleParams, UnitCircleState>) {
  const { initialAngle = 45, unit = 'degrees', showComponents = true } = params
  const [angleDeg, setAngleDeg] = useState(initialAngle)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.({ angle: angleDeg }) }, [angleDeg])

  const angleFromEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    const scaleX = 300 / rect.width
    const scaleY = 300 / rect.height
    const mx = (e.clientX - rect.left) * scaleX - CX
    const my = -((e.clientY - rect.top) * scaleY - CY)
    return (Math.atan2(my, mx) * 180) / Math.PI
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    const raw = angleFromEvent(e)
    setAngleDeg(((raw % 360) + 360) % 360)
  }, [angleFromEvent])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const raw = angleFromEvent(e)
    setAngleDeg(((raw % 360) + 360) % 360)
  }, [angleFromEvent])

  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  const rad = toRad(angleDeg)
  const px = CX + R * Math.cos(rad)
  const py = CY - R * Math.sin(rad)
  const displayAngle = unit === 'degrees' ? `${angleDeg.toFixed(1)}°` : `${rad.toFixed(3)} rad`

  const targetRad = targetState != null ? toRad(targetState.angle ?? 0) : null
  const tpx = targetRad !== null ? CX + R * Math.cos(targetRad) : 0
  const tpy = targetRad !== null ? CY - R * Math.sin(targetRad) : 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 select-none">
      <svg
        ref={svgRef}
        width="100%"
        viewBox="0 0 300 300"
        overflow="visible"
        style={{ cursor: dragging.current ? 'grabbing' : 'default', maxWidth: '360px', display: 'block', margin: '0 auto' }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={onMouseDown}
      >
        <line x1={20} y1={CY} x2={280} y2={CY} stroke="#e5e7eb" strokeWidth={1} />
        <line x1={CX} y1={20} x2={CX} y2={280} stroke="#e5e7eb" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#d1d5db" strokeWidth={1.5} />

        {showComponents && (
          <>
            <line x1={CX} y1={CY} x2={px} y2={CY} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />
            <line x1={px} y1={CY} x2={px} y2={py} stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" />
          </>
        )}

        <line x1={CX} y1={CY} x2={px} y2={py} stroke="#6366f1" strokeWidth={2} />

        {targetRad !== null && (
          <>
            <line x1={CX} y1={CY} x2={tpx} y2={tpy} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.4} />
            <circle cx={tpx} cy={tpy} r={7} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.4} />
          </>
        )}

        <circle cx={px} cy={py} r={8} fill="#6366f1" stroke="white" strokeWidth={2} style={{ cursor: 'grab' }} />

        {showComponents && (
          <>
            <text x={(CX + px) / 2} y={CY + 16} fontSize={12} fill="#f59e0b" textAnchor="middle">cos = {fmt(Math.cos(rad))}</text>
            <text x={px + 6} y={(CY + py) / 2 + 3} fontSize={12} fill="#10b981">sin = {fmt(Math.sin(rad))}</text>
          </>
        )}
      </svg>
      <p className="text-center text-xs text-gray-500 -mt-1">θ = {displayAngle}</p>
    </div>
  )
}
