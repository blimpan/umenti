'use client'

import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Slider } from '../shared/Slider'
import type { VisualizationTemplateProps } from '../shared/types'

export type ProbabilityDistributionParams = {
  distribution: 'normal' | 'binomial'
  mean?: number; stdDev?: number
  n?: number; p?: number
  showMean?: boolean
}

export type ProbabilityDistributionState =
  | { mean: number; stdDev: number }
  | { n: number; p: number }

function normalPDF(x: number, mean: number, sd: number) {
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / sd) ** 2)
}

function binomCoeff(n: number, k: number): number {
  if (k > n || k < 0) return 0
  if (k === 0 || k === n) return 1
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return r
}

function binomPMF(k: number, n: number, p: number) {
  return binomCoeff(n, k) * p ** k * (1 - p) ** (n - k)
}

function buildNormalData(mean: number, sd: number) {
  const range = Math.max(4 * sd, 1)
  return Array.from({ length: 200 }, (_, i) => {
    const x = mean - range + (i / 199) * 2 * range
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(normalPDF(x, mean, sd).toFixed(5)), xLabel: '' }
  })
}

function buildBinomData(n: number, p: number) {
  return Array.from({ length: n + 1 }, (_, k) => ({
    x: k,
    y: parseFloat(binomPMF(k, n, p).toFixed(5)),
    xLabel: String(k),
  }))
}

export default function ProbabilityDistribution({
  params, targetState, onStateChange,
}: VisualizationTemplateProps<ProbabilityDistributionParams, ProbabilityDistributionState>) {
  const { distribution, showMean = true } = params
  const [mean, setMean]     = useState(params.mean ?? 0)
  const [stdDev, setStdDev] = useState(params.stdDev ?? 1)
  const [n, setN]           = useState(params.n ?? 10)
  const [p, setP]           = useState(params.p ?? 0.5)

  const state = distribution === 'normal' ? { mean, stdDev } : { n, p }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.(state) }, [mean, stdDev, n, p])

  const data = distribution === 'normal' ? buildNormalData(mean, stdDev) : buildBinomData(n, p)

  const targetData = targetState
    ? distribution === 'normal'
      ? buildNormalData(
          (targetState as Partial<{ mean: number; stdDev: number }>).mean ?? mean,
          (targetState as Partial<{ mean: number; stdDev: number }>).stdDev ?? stdDev
        )
      : buildBinomData(
          Math.round((targetState as Partial<{ n: number; p: number }>).n ?? n),
          (targetState as Partial<{ n: number; p: number }>).p ?? p
        )
    : null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey={distribution === 'normal' ? 'x' : 'xLabel'}
            stroke="#9ca3af"
            tick={{ fontSize: 9 }}
            interval={distribution === 'normal' ? 'preserveStartEnd' : 0}
          />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 9 }} />
          {showMean && distribution === 'normal' && (
            <ReferenceLine x={mean} stroke="#6366f1" strokeDasharray="3 2" opacity={0.6} />
          )}
          <Area type="monotone" dataKey="y" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} dot={false} isAnimationActive={false} />
          {targetData && (
            <Area data={targetData} type="monotone" dataKey="y" stroke="#6366f1" fill="none" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
          )}
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-col gap-2.5">
        {distribution === 'normal' ? (
          <>
            <Slider label="Mean (μ)" value={mean} min={-5} max={5} step={0.1} onChange={setMean} />
            <Slider label="Std Dev (σ)" value={stdDev} min={0.1} max={5} step={0.1} onChange={setStdDev} />
          </>
        ) : (
          <>
            <Slider label="Trials (n)" value={n} min={2} max={50} step={1} onChange={v => setN(Math.round(v))} />
            <Slider label="Probability (p)" value={p} min={0.01} max={0.99} step={0.01} onChange={setP} />
          </>
        )}
      </div>
    </div>
  )
}
