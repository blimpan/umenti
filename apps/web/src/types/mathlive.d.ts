// Type declaration for the MathLive <math-field> web component
import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          value?: string
          class?: string
          'virtual-keyboard-mode'?: string
        },
        HTMLElement
      >
    }
  }
}
