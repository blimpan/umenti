export interface VisualizationTemplateProps<
  P,
  S extends Record<string, number | string | boolean> = Record<string, number>,
> {
  params: P
  targetState?: Partial<S>
  onStateChange?: (state: S) => void
}
