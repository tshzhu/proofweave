import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import {
  DEFAULT_MATH_SPACING_OPTIONS,
  formatMathSpacing,
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
    fontCommandBraces: false,
    collapseSpaces: false,
    [rule]: true,
  }
}

test('formats the requested examples without changing mathematical tokens', () => {
  const examples = new Map([
    ['n<1', 'n < 1'],
    ['x*y', 'x * y'],
    ['|f(x)|\\le1', '| f(x) | \\le 1'],
    ['f(x+(y+(\\sin z)^2)^2)', 'f(x + (y + (\\sin z)^2)^2)'],
    ['x_{(1)},\\cdots,x_{(T)}', 'x_{(1)}, \\cdots, x_{(T)}'],
  ])

  for (const [input, expected] of examples) {
    const actual = formatMathSpacing(input)
    assert.equal(actual, expected)
    assert.equal(actual.replace(/\s/g, ''), input.replace(/\s/g, ''))
  }
  assert.match(formatMathSpacing('|f(x)|\\le1'), /\\le 1$/)
  assert.doesNotMatch(formatMathSpacing('|f(x)|\\le1'), /C/)
})

test('the master switch preserves the math body byte for byte', () => {
  const input = '  |f ( x )|\\le1,\\quad y*z  '
  assert.equal(formatMathSpacing(input, {
    ...DEFAULT_MATH_SPACING_OPTIONS,
    enabled: false,
  }), input)
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

  assert.equal(formatMathSpacing(String.raw`\mathcal X`, {
    ...DEFAULT_MATH_SPACING_OPTIONS,
    fontCommandBraces: false,
    collapseSpaces: false,
  }), String.raw`\mathcal X`)
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
  assert.equal(formatMathSpacing('|f(x)|\\le1', only('pairedBars')), '| f(x) |\\le1')
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
  assert.equal(formatMathSpacing('&\\le y'), '&\\le y')
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
    [String.raw`\mathbb{S}^d = \{x \in \mathbb{R}^{d+1}:\|x\|_2 = 1\},\qquad d \ge 1,`, String.raw`\mathbb{S}^d = \{x \in \mathbb{R}^{d+1} : \|x\|_2 = 1\}, \qquad d \ge 1,`],
    [String.raw`\mu_t(x) = k_t(x)^\top(K_t + \rho I_t)^{-1}y_t,`, String.raw`\mu_t(x) = k_t(x)^\top (K_t + \rho I_t)^{-1} y_t,`],
    [String.raw`\mathbb{E} e^{u\varepsilon_i} \le e^{u^2\varsigma^2/2}`, String.raw`\mathbb{E} e^{u \varepsilon_i} \le e^{u^2 \varsigma^2 / 2}`],
    [String.raw`\kappa = \frac{d\theta}{d + \theta}.`, String.raw`\kappa = \frac{d \theta}{d + \theta}.`],
    [String.raw`f - \widehat f_t = A^{-1}(\rho f - \Phi^*\varepsilon_{1:t}).`, String.raw`f - \widehat{f}_t = A^{-1} (\rho f - \Phi^* \varepsilon_{1:t}).`],
  ])
  for (const [input, expected] of examples) assert.equal(formatMathSpacing(input), expected)
})

test('collapses repeated source spaces without touching explicit spacing commands', () => {
  const input = String.raw`A^{-1}\Phi^*\varepsilon_{1:t}                    \tag{1}`
  assert.equal(formatMathSpacing(input), String.raw`A^{-1} \Phi^* \varepsilon_{1:t} \tag{1}`)
  assert.equal(formatMathSpacing(input, { ...DEFAULT_MATH_SPACING_OPTIONS, collapseSpaces: false }), String.raw`A^{-1} \Phi^* \varepsilon_{1:t}                    \tag{1}`)
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
  assert.match(once, /w &\\le 1/)
  assert.equal(once.split('\n').length, input.split('\n').length)
  assert.equal(once.replace(/\s/g, ''), input.replace(/\s/g, ''))
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
    const output = formatMathSpacing(input)
    assert.equal(formatMathSpacing(output), output)
    assert.equal(output.replace(/\s/g, ''), input.replace(/\s/g, ''))
  }
})
