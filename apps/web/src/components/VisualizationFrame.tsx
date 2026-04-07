'use client'

import { useRef, useEffect } from 'react'

interface Props {
  html: string
  onStateChange?: (state: Record<string, unknown>) => void
  height?: number
}

// Renders LLM-generated HTML inside a sandboxed iframe.
// sandbox="allow-scripts" without allow-same-origin gives the iframe a null origin
// so it cannot read parent cookies, DOM, or localStorage — even with srcdoc.
// Communication from iframe → parent is via window.parent.postMessage only.
export default function VisualizationFrame({ html, onStateChange, height = 320 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // Only accept messages from this specific iframe
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type === 'viz-state' && onStateChange) {
        const payload = e.data?.data
        if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
          onStateChange(payload as Record<string, unknown>)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onStateChange])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      sandbox="allow-scripts"
      className="w-full rounded-lg border border-gray-200"
      style={{ height }}
      title="Interactive visualization"
    />
  )
}
