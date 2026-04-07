# Math Syntax Contract

All AI-generated content in Metis must use the following canonical math syntax.
This contract applies to theory blocks, exercise questions, answer options, sample answers, and rubrics.

## Delimiters

| Use case | Syntax | Example |
|---|---|---|
| Inline math | `$...$` | `The derivative of $f(x) = x^2$ is $2x$.` |
| Block (display) math | `$$...$$` on its own line | `$$\int_0^1 x^2 \, dx = \frac{1}{3}$$` |
| Literal dollar sign (currency) | `\$` | `The price is \$50.` |

Block math (`$$...$$`) must appear on its own line, not inline with text.

## Allowed Macros

Standard KaTeX macros are supported. Common ones:

- Fractions: `\frac{a}{b}`
- Roots: `\sqrt{x}`, `\sqrt[n]{x}`
- Subscript / superscript: `x_i`, `x^2`
- Greek letters: `\alpha`, `\beta`, `\gamma`, `\delta`, `\theta`, `\lambda`, `\mu`, `\pi`, `\sigma`, `\omega`
- Operators: `\sum`, `\prod`, `\int`, `\lim`, `\infty`
- Decorators: `\vec{v}`, `\hat{n}`, `\bar{x}`, `\dot{x}`, `\ddot{x}`
- Arrows: `\to`, `\leftarrow`, `\Rightarrow`, `\Leftrightarrow`
- Sets / logic: `\in`, `\notin`, `\subset`, `\cup`, `\cap`, `\forall`, `\exists`
- Norms / abs: `\|x\|`, `|x|`
- Matrices: `\begin{pmatrix}...\end{pmatrix}`, `\begin{bmatrix}...\end{bmatrix}`
- Partial derivatives: `\partial`
- Nabla: `\nabla`
- Spacing: `\,`, `\;`, `\quad`

## Forbidden Patterns

These must never appear in generated content:

| Pattern | Reason | Correct alternative |
|---|---|---|
| `\(...\)` | Alternative LaTeX inline delimiter, not supported by remark-math | `$...$` |
| `\[...\]` | Alternative LaTeX block delimiter, not supported by remark-math | `$$...$$` |
| Bare `$` for currency | Triggers math parser | `\$` |
| `$$...$$` inline (on same line as text) | Renders as inline, breaks layout | Put on its own line |

## Examples

**Inline:**
```
The gradient of $f(x, y) = x^2 + y^2$ is $\nabla f = (2x, 2y)$.
```

**Block:**
```
Evaluate the following integral:

$$\int_0^\infty e^{-x^2} \, dx = \frac{\sqrt{\pi}}{2}$$

Note that this is the Gaussian integral.
```

**Currency:**
```
If a product costs \$200 and is discounted by 15%, the new price is \$170.
```
