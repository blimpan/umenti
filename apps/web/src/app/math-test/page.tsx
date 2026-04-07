/**
 * DEV ONLY — visual regression page for math rendering.
 * Visit /math-test to verify KaTeX renders correctly after changes.
 */
import MathMarkdown from '@/components/MathMarkdown'

const FIXTURES: { label: string; input: string }[] = [
  {
    label: 'Inline math',
    input: 'The derivative of $f(x) = x^2$ is $f\'(x) = 2x$.',
  },
  {
    label: 'Block (display) math',
    input: 'Evaluate the Gaussian integral:\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}$$\n\nThis appears in probability theory.',
  },
  {
    label: 'Escaped currency',
    input: 'A bond costs \\$1,000 with a coupon rate of $r = 0.05$, paying \\$50 per year.',
  },
  {
    label: 'Fractions and roots',
    input: 'The quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.',
  },
  {
    label: 'Greek letters and subscripts',
    input: 'Let $\\mu$ be the mean and $\\sigma^2$ the variance. Then $X_i \\sim \\mathcal{N}(\\mu, \\sigma^2)$.',
  },
  {
    label: 'Multivariable calculus — gradient',
    input: 'For $f(x, y) = x^2 + y^2$, the gradient is:\n\n$$\\nabla f = \\left(\\frac{\\partial f}{\\partial x},\\, \\frac{\\partial f}{\\partial y}\\right) = (2x,\\, 2y)$$',
  },
  {
    label: 'Multivariable calculus — double integral',
    input: 'The volume under $f(x,y) = 1 - x^2 - y^2$ over the unit disk $D$:\n\n$$\\iint_D (1 - x^2 - y^2) \\, dA = \\frac{\\pi}{2}$$',
  },
  {
    label: 'Matrix',
    input: 'A rotation matrix by angle $\\theta$:\n\n$$R = \\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}$$',
  },
  {
    label: 'Inline + block in prose',
    input: 'The chain rule states that if $h(x) = f(g(x))$, then:\n\n$$h\'(x) = f\'(g(x)) \\cdot g\'(x)$$\n\nThis is essential for differentiating composite functions.',
  },
  {
    label: 'Multiple choice option with math',
    input: '$\\frac{d}{dx}\\left[x^3 \\ln x\\right] = 3x^2 \\ln x + x^2$',
  },
]

export default function MathTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="border-b border-gray-200 pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-1">Dev only</p>
          <h1 className="text-2xl font-bold text-gray-900">Math Rendering Test</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visual fixtures for KaTeX. Each card shows a label, the raw input, and the rendered output.
          </p>
        </div>

        {FIXTURES.map(({ label, input }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            </div>
            <div className="px-4 py-3 border-b border-dashed border-gray-100">
              <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">{input}</pre>
            </div>
            <div className="px-4 py-3 prose prose-sm max-w-none text-gray-900">
              <MathMarkdown>{input}</MathMarkdown>
            </div>
          </div>
        ))}

      </div>
    </div>
  )
}
