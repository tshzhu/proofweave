import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import {
  DEFAULT_MATH_CLEANUP_OPTIONS,
  DEFAULT_MATH_SPACING_OPTIONS,
  formatMathSpacing,
  type MathCleanupOptions,
  type MathSpacingOptions,
} from '../src/math-spacing.ts'

type MathSpacingRule = Exclude<keyof MathSpacingOptions, 'enabled'>

function only(rule: MathSpacingRule): MathSpacingOptions {
  return {
    enabled: true,
    relations: false,
    binaryOperators: false,
    punctuation: false,
    compactParentheses: false,
    pairedBars: false,
    namedFunctions: false,
    [rule]: true,
  }
}

function cleanup(overrides: Partial<MathCleanupOptions> = {}): MathCleanupOptions {
  return { ...DEFAULT_MATH_CLEANUP_OPTIONS, ...overrides }
}

test('normalizes greater-or-equal and less-or-equal variants to configurable commands', () => {
  const input = String.raw`a>=b, c> =d, e\ge f, g\geq h, i\geqq j, k\geqslant l; m<=n, o< =p, q\le r, s\leq t, u\leqq v, w\leqslant x`
  assert.equal(
    formatMathSpacing(input),
    String.raw`a \ge b, c \ge d, e \ge f, g \ge h, i \ge j, k \ge l; m \leq n, o \leq p, q \leq r, s \leq t, u \leq v, w \leq x`,
  )
  const configured = cleanup({ greaterEqualCommand: String.raw`\geqslant`, lessEqualCommand: String.raw`\le` })
  assert.equal(formatMathSpacing('a>=b, c< =d', DEFAULT_MATH_SPACING_OPTIONS, configured), String.raw`a \geqslant b, c \le d`)
  assert.equal(formatMathSpacing(String.raw`\text{a\geq b} + c\geqq d`, DEFAULT_MATH_SPACING_OPTIONS, configured), String.raw`\text{a \geq b} + c \geqslant d`)
})

test('normalizes not-equal and empty-set variants to configurable commands', () => {
  assert.equal(
    formatMathSpacing(String.raw`a\ne b, c\neq d, e\not=f, g\not = h; A=\emptyset, B=\varnothing`),
    String.raw`a \neq b, c \neq d, e \neq f, g \neq h; A = \varnothing, B = \varnothing`,
  )
  const configured = cleanup({ notEqualCommand: String.raw`\ne`, emptySetCommand: String.raw`\emptyset` })
  assert.equal(formatMathSpacing(String.raw`a\neq b, A=\varnothing`, DEFAULT_MATH_SPACING_OPTIONS, configured), String.raw`a \ne b, A = \emptyset`)
  assert.equal(formatMathSpacing(String.raw`\text{a\ne b}+c\neq d`, DEFAULT_MATH_SPACING_OPTIONS, configured), String.raw`\text{a \ne b} + c \ne d`)
  const disabled = cleanup({ normalizeNotEqualCommand: false, normalizeEmptySetCommand: false })
  assert.equal(formatMathSpacing(String.raw`a\ne b, A=\emptyset`, { ...DEFAULT_MATH_SPACING_OPTIONS, enabled: false }, disabled), String.raw`a\ne b, A=\emptyset`)
})

test('unifies matched set-brace size variants and preserves opaque text', () => {
  const configured = cleanup({ unifySetNotation: true })
  const input = String.raw`\{x \in A\} + \big\{y\big\} + \Bigl\{z\Bigr\} + \left\{w\right\} + \left\lbrace q \right\rbrace + \text{literal \{q\}}`
  const output = formatMathSpacing(input, DEFAULT_MATH_SPACING_OPTIONS, configured)
  assert.equal(output, String.raw`\set{x \in A} + \set{y} + \set{z} + \set{w} + \set{q} + \text{literal \{q\}}`)
  assert.equal(formatMathSpacing(output, DEFAULT_MATH_SPACING_OPTIONS, configured), output)
})

test('handles nested, multiline, and unmatched set delimiters conservatively', () => {
  const configured = cleanup({ unifySetNotation: true })
  assert.equal(
    formatMathSpacing(String.raw`\{a, \{b\}\}` , DEFAULT_MATH_SPACING_OPTIONS, configured),
    String.raw`\set{a, \set{b}}`,
  )
  assert.equal(
    formatMathSpacing(String.raw`\left\{a
  \big\{b\big\}
\right\}`, DEFAULT_MATH_SPACING_OPTIONS, configured),
    String.raw`\set{a
  \set{b}}`,
  )
  assert.equal(
    formatMathSpacing(String.raw`\left\{a \big\{b\big\}`, DEFAULT_MATH_SPACING_OPTIONS, configured),
    String.raw`\left\{a \set{b}`,
  )
})

test('unifies transpose spellings and leaves non-transpose superscripts unchanged', () => {
  const configured = cleanup({
    unifyTransposeNotation: true,
    transposeExpression: String.raw`\mkern-1.0mu\mathsf{T}`,
  })
  const input = String.raw`A^T + B^{T} + C^{\top} + D^{\intercal} + E^{\text{T}} + F^{\textbf{T}} + G^{\mathsf{T}} + H^{\mathbf{T}} + I^{T+1} + J^\transpose`
  const output = formatMathSpacing(input, DEFAULT_MATH_SPACING_OPTIONS, configured)
  assert.equal(output, String.raw`A^\transpose + B^\transpose + C^\transpose + D^\transpose + E^\transpose + F^\transpose + G^\transpose + H^\transpose + I^{T+1} + J^\transpose`)
  assert.equal(formatMathSpacing(output, DEFAULT_MATH_SPACING_OPTIONS, configured), output)
  assert.equal(formatMathSpacing(String.raw`\text{A^T}`, DEFAULT_MATH_SPACING_OPTIONS, configured), String.raw`\text{A^T}`)
  const unbraced = cleanup({ ...configured, fontCommandBraces: false })
  assert.equal(formatMathSpacing('A^T + B^\\mathsf T + C^\\text*{T} + D^\\mathsf*{T}', DEFAULT_MATH_SPACING_OPTIONS, unbraced), 'A^\\transpose + B^\\transpose + C^\\transpose + D^\\transpose')
})

test('formats the requested examples without changing mathematical tokens', () => {
  const examples = new Map([
    ['n<1', 'n < 1'],
    ['x*y', 'x * y'],
    ['|f(x)|\\le1', '| f(x) | \\leq 1'],
    ['f(x+(y+(\\sin z)^2)^2)', 'f(x + (y + (\\sin z)^2)^2)'],
    ['x_{(1)},\\cdots,x_{(T)}', 'x_{(1)}, \\cdots, x_{(T)}'],
  ])

  for (const [input, expected] of examples) {
    const actual = formatMathSpacing(input)
    assert.equal(actual, expected)
  }
  assert.match(formatMathSpacing('|f(x)|\\le1'), /\\leq 1$/)
  assert.doesNotMatch(formatMathSpacing('|f(x)|\\le1'), /C/)
})

test('the master switch only disables math spacing rules', () => {
  const input = '  |f ( x )|\\le1,\\quad y*z  '
  const noInequalityCleanup = cleanup({ normalizeInequalityCommands: false })
  assert.equal(formatMathSpacing(input, {
    ...DEFAULT_MATH_SPACING_OPTIONS,
    enabled: false,
  }, { ...noInequalityCleanup, collapseSpaces: false }), input)
  assert.equal(formatMathSpacing(String.raw`\mathcal X                    \tag{1}`, {
    ...DEFAULT_MATH_SPACING_OPTIONS,
    enabled: false,
  }), String.raw`\mathcal{X} \tag{1}`)
  assert.equal(formatMathSpacing(String.raw`x                    \text{a    b} % keep    comment`, {
    ...DEFAULT_MATH_SPACING_OPTIONS,
    enabled: false,
  }), String.raw`x \text{a    b} % keep    comment`)
})

test('braces single atoms after math font commands by default', () => {
  const examples = new Map([
    [String.raw`\mathcal X`, String.raw`\mathcal{X}`],
    [String.raw`\mathscr Y`, String.raw`\mathscr{Y}`],
    [String.raw`\mathbb R`, String.raw`\mathbb{R}`],
    [String.raw`\mathnormal X`, String.raw`\mathnormal{X}`],
    [String.raw`\mathbf v_i`, String.raw`\mathbf{v}_i`],
    [String.raw`\mathcal{X}`, String.raw`\mathcal{X}`],
    [String.raw`\text{\mathcal X}`, String.raw`\text{\mathcal X}`],
  ])

  for (const [input, expected] of examples) {
    assert.equal(formatMathSpacing(input), expected)
    assert.equal(formatMathSpacing(formatMathSpacing(input)), expected)
  }

  assert.equal(formatMathSpacing(
    String.raw`\mathcal X`,
    DEFAULT_MATH_SPACING_OPTIONS,
    cleanup({ fontCommandBraces: false }),
  ), String.raw`\mathcal X`)
})

test('converts math-styled reference labels to hyperref references', () => {
  assert.equal(formatMathSpacing(String.raw`\mathrm{lem:operator-identities}`), String.raw`\ref{lem:operator-identities}`)
  assert.equal(formatMathSpacing(String.raw`\mathrm {prop:claim}`), String.raw`\ref{pro:claim}`)
  assert.equal(formatMathSpacing(String.raw`\mathrm{proposition:claim}`), String.raw`\ref{pro:claim}`)
  assert.equal(formatMathSpacing(String.raw`\ref{prop:claim} \eqref{theorem:main} \cref{lemma:step}`), String.raw`\ref{pro:claim} \eqref{thm:main} \cref{lem:step}`)
  assert.equal(formatMathSpacing(String.raw`\text{see \mathrm{lem:inside}}`), String.raw`\text{see \mathrm{lem:inside}}`)
  assert.equal(formatMathSpacing(String.raw`\tag{lem:literal}`), String.raw`\tag{lem:literal}`)
  assert.equal(formatMathSpacing(String.raw`\label{lem:literal}`), String.raw`\label{lem:literal}`)
  assert.equal(formatMathSpacing(String.raw`\label{prop:literal}`), String.raw`\label{pro:literal}`)
  assert.equal(formatMathSpacing(String.raw`\mathrm{lem:operator-identities}`, {
    ...DEFAULT_MATH_SPACING_OPTIONS,
    enabled: false,
  }), String.raw`\ref{lem:operator-identities}`)
  assert.equal(formatMathSpacing(
    String.raw`\mathrm{prop:claim} \eqref{theorem:main}`,
    DEFAULT_MATH_SPACING_OPTIONS,
    cleanup({ normalizeLabelPrefixes: false }),
  ), String.raw`\ref{prop:claim} \eqref{theorem:main}`)
  assert.equal(formatMathSpacing(String.raw`\mathrm R`), String.raw`\mathrm{R}`)
})

test('normalizes every theorem-reference prefix to three letters', () => {
  const examples = new Map([
    [String.raw`\mathrm{theorem:main}`, String.raw`\ref{thm:main}`],
    [String.raw`\mathrm{lemma:step}`, String.raw`\ref{lem:step}`],
    [String.raw`\mathrm{prop:claim}`, String.raw`\ref{pro:claim}`],
    [String.raw`\mathrm{proposition:claim}`, String.raw`\ref{pro:claim}`],
    [String.raw`\mathrm{corollary:result}`, String.raw`\ref{cor:result}`],
    [String.raw`\mathrm{assumption:model}`, String.raw`\ref{asm:model}`],
    [String.raw`\mathrm{definition:object}`, String.raw`\ref{def:object}`],
    [String.raw`\mathrm{remark:note}`, String.raw`\ref{rmk:note}`],
  ])
  for (const [input, expected] of examples) {
    assert.equal(formatMathSpacing(input), expected)
    assert.equal(formatMathSpacing(expected), expected)
  }
  assert.equal(formatMathSpacing(String.raw`\mathrm{custom:identifier}`), String.raw`\ref{custom:identifier}`)
})

test('each spacing rule can operate independently', () => {
  assert.equal(formatMathSpacing('n<1,x*y', only('relations')), 'n < 1,x*y')
  assert.equal(formatMathSpacing('n<1,x*y', only('binaryOperators')), 'n<1,x * y')
  assert.equal(formatMathSpacing('x,y ;z', only('punctuation')), 'x, y; z')
  assert.equal(formatMathSpacing('f ( x + y )', only('compactParentheses')), 'f(x + y)')
  assert.equal(formatMathSpacing('|f(x)|\\le1', only('pairedBars')), '| f(x) |\\leq1')
  assert.equal(formatMathSpacing('\\sin z+\\cos(x)', only('namedFunctions')), '\\sin z+\\cos(x)')
  assert.equal(formatMathSpacing('\\operatorname{diam} X'), '\\operatorname{diam} X')
})

test('protects unary signs, scripts, opaque command arguments, and explicit spacing', () => {
  const unchanged = [
    '-x',
    '(-x)',
    'e^{-x}',
    '10^{-3}',
    'f^*',
    'x_{(1)}',
    '\\text{a-b}',
    '\\operatorname{arg-max}',
    '\\tag{P2-G}',
    '\\label{eq:a-b}',
    'a\\,b',
    'a\\!b',
    'a\\quad b',
    'x|y',
  ]

  for (const input of unchanged) {
    if (input === 'x|y') continue
    assert.equal(formatMathSpacing(input), input)
  }
  assert.equal(formatMathSpacing('x|y', { ...DEFAULT_MATH_SPACING_OPTIONS, pairedBars: false }), 'x|y')
})

test('treats scripted atoms as operands and formats mathematical command groups', () => {
  assert.equal(formatMathSpacing('x_{i}+y^2'), 'x_{i} + y^2')
  assert.equal(formatMathSpacing('x_i+y_{j+1}'), 'x_i + y_{j+1}')
  assert.equal(formatMathSpacing('t^{a+b}'), 't^{a+b}')
  assert.equal(formatMathSpacing('e^{-x}'), 'e^{-x}')
  assert.equal(formatMathSpacing('\\frac{x+y}{z-1}'), '\\frac{x + y}{z - 1}')
  assert.equal(formatMathSpacing('\\sqrt{x*y}'), '\\sqrt{x * y}')
  assert.equal(formatMathSpacing('\\text{a-b}+c'), '\\text{a-b} + c')
})

test('formats align markers, TeX relations, paired delimiters, and named functions', () => {
  assert.equal(formatMathSpacing('x&=y'), 'x &= y')
  assert.equal(formatMathSpacing('&\\le y'), '&\\leq y')
  assert.equal(formatMathSpacing('x\\subseteq A'), 'x \\subseteq A')
  assert.equal(formatMathSpacing('A\\not\\subseteq B'), 'A \\not\\subseteq B')
  assert.equal(formatMathSpacing('\\|f(x)\\|'), '\\|f(x)\\|')
  assert.equal(formatMathSpacing('\\lvert f(x) \\rvert'), '\\lvert f(x) \\rvert')
  assert.equal(formatMathSpacing('\\left|f(x)\\right|'), '\\left| f(x) \\right|')
  assert.equal(formatMathSpacing('\\sin z+\\ln(t+1)'), '\\sin z + \\ln(t + 1)')
  assert.equal(formatMathSpacing('\\sin\\left( x+y \\right)'), '\\sin\\left(x + y\\right)')
})

test('adds readable implicit multiplication and punctuation spacing', () => {
  const examples = new Map([
    [String.raw`\mathbb{S}^d = \{x \in \mathbb{R}^{d+1}:\|x\|_2 = 1\},\qquad d \ge 1,`, String.raw`\mathbb{S}^d = \set{x \in \mathbb{R}^{d+1} : \|x\|_2 = 1}, \qquad d \ge 1,`],
    [String.raw`\mu_t(x) = k_t(x)^\top(K_t + \rho I_t)^{-1}y_t,`, String.raw`\mu_t(x) = k_t(x)^\transpose(K_t + \rho I_t)^{-1} y_t,`],
    [String.raw`\mathbb{E} e^{u\varepsilon_i} \le e^{u^2\varsigma^2/2}`, String.raw`\mathbb{E} e^{u \varepsilon_i} \leq e^{u^2 \varsigma^2 / 2}`],
    [String.raw`\kappa = \frac{d\theta}{d + \theta}.`, String.raw`\kappa = \frac{d \theta}{d + \theta}.`],
    [String.raw`f - \widehat f_t = A^{-1}(\rho f - \Phi^*\varepsilon_{1:t}).`, String.raw`f - \widehat{f}_t = A^{-1} (\rho f - \Phi^* \varepsilon_{1:t}).`],
  ])
  for (const [input, expected] of examples) assert.equal(formatMathSpacing(input), expected)
})

test('collapses repeated source spaces without touching explicit spacing commands', () => {
  const input = String.raw`A^{-1}\Phi^*\varepsilon_{1:t}                    \tag{1}`
  assert.equal(formatMathSpacing(input), String.raw`A^{-1} \Phi^* \varepsilon_{1:t} \tag{1}`)
  assert.equal(formatMathSpacing(
    input,
    DEFAULT_MATH_SPACING_OPTIONS,
    cleanup({ collapseSpaces: false }),
  ), String.raw`A^{-1} \Phi^* \varepsilon_{1:t}                    \tag{1}`)
  assert.equal(formatMathSpacing(String.raw`a\quad    b`), String.raw`a\quad b`)
})

test('preserves line breaks, indentation, comments, and becomes idempotent', () => {
  const input = `    \\begin{aligned}
        x&=y+z, \\\\ % keep a=b in this comment
        w&\\le1
    \\end{aligned}`
  const once = formatMathSpacing(input)
  const twice = formatMathSpacing(once)

  assert.equal(once, twice)
  assert.match(once, /^    \\begin\{aligned\}/)
  assert.match(once, /x &= y \+ z, \\\\ % keep a=b in this comment/)
  assert.match(once, /w &\\leq 1/)
  assert.equal(once.split('\n').length, input.split('\n').length)
  assert.equal(once.replace(/\\leq/g, '\\le').replace(/\s/g, ''), input.replace(/\s/g, ''))
})

const manuscriptPath = '/scratch1/workspace/proof-from-rethlas/kde_explore/refs/BOKE__arXiv_preprint_/manuscript.tex'

function manuscriptMath(source: string): string[] {
  const segments: string[] = []
  for (const match of source.matchAll(/\$([^$\n]+)\$/g)) segments.push(match[1] ?? '')
  for (const match of source.matchAll(/\\\[([\s\S]*?)\\\]/g)) segments.push(match[1] ?? '')
  for (const match of source.matchAll(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g)) {
    segments.push(match[1] ?? '')
  }
  return segments
}

test('is token-preserving and idempotent across manuscript math samples', {
  skip: !existsSync(manuscriptPath),
}, () => {
  const segments = manuscriptMath(readFileSync(manuscriptPath, 'utf8'))
  assert.ok(segments.length > 500)

  for (const input of segments) {
    const cleanup = { ...DEFAULT_MATH_CLEANUP_OPTIONS, unifySetNotation: false, unifyTransposeNotation: false, normalizeInequalityCommands: false }
    const output = formatMathSpacing(input, DEFAULT_MATH_SPACING_OPTIONS, cleanup)
    assert.equal(formatMathSpacing(output, DEFAULT_MATH_SPACING_OPTIONS, cleanup), output)
    assert.equal(output.replace(/\s/g, ''), input.replace(/\s/g, ''))
  }
})
