'use client'

import dynamic from 'next/dynamic'
import VisualizationFrame from '@/components/VisualizationFrame'
import type { VisualizationTemplateProps } from './shared/types'

// Lazy-load templates — they import Recharts which is large
const CartesianGraph          = dynamic(() => import('./templates/CartesianGraph'))
const UnitCircle              = dynamic(() => import('./templates/UnitCircle'))
const ProbabilityDistribution = dynamic(() => import('./templates/ProbabilityDistribution'))
const GeometricShapeExplorer  = dynamic(() => import('./templates/GeometricShapeExplorer'))

// Registry: add new templates here only
const REGISTRY: Record<string, React.ComponentType<VisualizationTemplateProps<any, any>>> = {
  cartesian_graph:          CartesianGraph,
  unit_circle:              UnitCircle,
  probability_distribution: ProbabilityDistribution,
  geometric_shape_explorer: GeometricShapeExplorer,
}

interface Props {
  templateId?: string | null
  params?: Record<string, unknown> | null
  targetState?: Record<string, number> | null
  onStateChange?: (state: Record<string, unknown>) => void
  customHtml?: string | null
}

export default function VisualizationRenderer({
  templateId, params, targetState, onStateChange, customHtml,
}: Props) {
  if (templateId) {
    const Template = REGISTRY[templateId]
    if (Template) {
      return (
        <Template
          params={params ?? {}}
          targetState={targetState ?? undefined}
          onStateChange={onStateChange}
        />
      )
    }
    console.warn(`[VisualizationRenderer] Unknown templateId: "${templateId}" — falling back to custom HTML`)
  }
  if (customHtml) {
    return <VisualizationFrame html={customHtml} onStateChange={onStateChange} />
  }
  return null
}
