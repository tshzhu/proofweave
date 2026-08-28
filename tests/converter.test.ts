import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { EXAMPLE_MARKDOWN } from '../src/example.ts'
import { convertMarkdown, DEFAULT_RENDER_OPTIONS } from '../src/renderer.ts'
import { DEFAULT_MATH_CLEANUP_OPTIONS, DEFAULT_MATH_SPACING_OPTIONS, formatMathSpacing } from '../src/math-spacing.ts'

test('uses the requested formatter defaults', () => {
  assert.deepEqual(DEFAULT_RENDER_OPTIONS, {
    indent: 'tab',
    inlineMath: 'dollar',
    statementDisplayMath: 'equation',
    outsideDisplayMath: 'brackets',
    sectionNumbering: 'unnumbered',
    cleanup: { removeBoxed: true, normalizeLabelPrefixes: true, fontCommandBraces: true, collapseSpaces: true },
    mathSpacing: { enabled: true, relations: true, binaryOperators: true, punctuation: true, compactParentheses: true, pairedBars: true, namedFunctions: true },
  })
})

test('renders the built-in example with structural blank lines only', () => {
  assert.equal(convertMarkdown(EXAMPLE_MARKDOWN).latex, String.raw`\section*{Part I -- A small estimate}

This example demonstrates headings, theorem environments, lists, and math.

% This Markdown note is kept as LaTeX comments.
% ## This heading stays commented out
% \[x*y\]

\begin{lemma}\label{lem:uniform-noise}
	For every $x \in \mathcal{X}$,
	\begin{equation}
		  | f(x) | \le C.
	\end{equation}
\end{lemma}

\begin{proof}
	By the preceding estimate, the claim follows.
\end{proof}

\begin{proposition}\label{pro:finite-sample}
	Assume $n \ge 1$. Then the estimator is well-defined.
\end{proposition}

\begin{proof}
	The construction is deterministic, so the result follows.
\end{proof}

\subsection*{A useful checklist}

\begin{itemize}
	\item Keep the statement readable.
	\item Preserve $\mathcal{X}$ exactly.
		\begin{itemize}
			\item Nested items are supported.
		\end{itemize}
	\item Use a display when a formula deserves its own line.
\end{itemize}`)
})

test('renders a theorem statement and proof with a stable label', () => {
  const result = convertMarkdown(String.raw`## lemma uniform-noise

### statement

For every \(x\in\mathcal X\), the bound holds.

### proof

The estimate proves the claim. \square`)

  assert.equal(result.diagnostics.length, 0)
  assert.equal(result.latex, String.raw`\begin{lemma}\label{lem:uniform-noise}
	For every $x \in \mathcal{X}$, the bound holds.
\end{lemma}

\begin{proof}
	The estimate proves the claim.
\end{proof}`)
})

test('converts Markdown comments line by line without parsing their contents', () => {
  const result = convertMarkdown(`Before.
<!--
# not a heading
\\[x*y\\]
- not a list
-->
After.`)

  assert.equal(result.diagnostics.length, 0)
  assert.equal(result.latex, String.raw`Before.

% # not a heading
% \[x*y\]
% - not a list

After.`)
  assert.doesNotMatch(result.latex, /\\section|\\item|\\begin\{equation\}/)
})

test('preserves ordinary text around same-line comments and warns on unclosed comments', () => {
  const inline = convertMarkdown('Before <!-- hidden --> After')
  assert.equal(inline.latex, String.raw`Before

%  hidden

After`)
  assert.equal(inline.diagnostics.length, 0)

  const unclosed = convertMarkdown(`<!--
still hidden`)
  assert.match(unclosed.latex, /^% still hidden$/)
  assert.ok(unclosed.diagnostics.some(({ code }) => code === 'unclosed-comment'))
})

test('keeps comments opaque while scanning theorem boundaries and nested lists', () => {
  const result = convertMarkdown(`## lemma comment-scope

### statement

Claim.

<!--
### proof
This is not a proof heading.
- Nor is this an active list item.
-->

### proof

The actual proof follows.

- Visible item
  <!--
  ## not a section
  \\[z=1\\]
  -->`)

  assert.equal(result.diagnostics.length, 0)
  assert.match(result.latex, /\\begin\{lemma\}\\label\{lem:comment-scope\}/)
  assert.match(result.latex, /\\begin\{proof\}\n\tThe actual proof follows\./)
  assert.match(result.latex, /% This is not a proof heading/)
  assert.match(result.latex, /% - Nor is this an active list item\./)
  assert.doesNotMatch(result.latex, /\n\t### proof|\n\t- Nor is this an active list item/)
  assert.match(result.latex, /\\item Visible item/)
  assert.match(result.latex, /% ## not a section/)
  assert.match(result.latex, /% \\\[z=1\\\]/)
  assert.equal((result.latex.match(/\\begin\{proof\}/g) ?? []).length, 1)
  assert.equal((result.latex.match(/\\section|\\subsection|\\subsubsection/g) ?? []).length, 0)
})

test('trims only comment-edge blank lines and separates adjacent comment blocks', () => {
  const result = convertMarkdown(`Before.
<!--

First paragraph.

Second paragraph.

-->
<!-- -->
<!--
Third paragraph.
-->
After.`)

  assert.equal(result.diagnostics.length, 0)
  assert.equal(result.latex, String.raw`Before.

% First paragraph.
%
% Second paragraph.

% Third paragraph.

After.`)
  assert.doesNotMatch(result.latex, /%\n% First paragraph|Second paragraph\.\n%\n\nAfter/)
})

test('normalizes math-styled theorem references in inline and display math', () => {
  const result = convertMarkdown(String.raw`See \(\mathrm{lem:operator-identities}\) for the identity.

\[
\mathrm{prop:claim}
\]`)
  assert.match(result.latex, /See \$\\ref\{lem:operator-identities\}\$ for the identity\./)
  assert.match(result.latex, /\\\[\n\t\\ref\{pro:claim\}\n\\\]/)
})

test('removes only proof-final QED markers, including display-wrapped markers', () => {
  const result = convertMarkdown(String.raw`## lemma qed

### statement
The statement contains an inline $\square$ marker that must remain.

### proof
The proof body ends here.

\[
\square
\]`)

  assert.match(result.latex, /statement contains an inline \$\\square\$ marker/)
  assert.match(result.latex, /\\begin\{proof\}\n\tThe proof body ends here\./)
  assert.doesNotMatch(result.latex, /\\begin\{proof\}[\s\S]*\\square/)
})

test('normalizes all supported labels and resolves duplicates', () => {
  const input = [
    ['theorem', 'thm:main'],
    ['lemma', 'lem:step'],
    ['proposition', 'prop:claim'],
    ['corollary', 'cor:result'],
    ['assumption', 'asm:model'],
    ['definition', 'def:object'],
    ['remark', 'rmk:note'],
    ['lemma', 'lem:step'],
  ].map(([kind, identifier]) => `## ${kind} ${identifier}\n\n### statement\nText.`).join('\n\n')

  const result = convertMarkdown(input)
  for (const label of [
    'thm:main', 'lem:step', 'pro:claim', 'cor:result',
    'asm:model', 'def:object', 'rmk:note', 'lem:step-2',
  ]) {
    assert.match(result.latex, new RegExp(`\\\\label\\{${label}\\}`))
  }
  assert.ok(result.diagnostics.some(({ code }) => code === 'duplicate-label'))
})

test('uses canonical three-letter prefixes for every theorem environment', () => {
  const input = [
    ['theorem', 'theorem:main'],
    ['lemma', 'lemma:step'],
    ['proposition', 'prop:claim'],
    ['corollary', 'corollary:result'],
    ['assumption', 'assumption:model'],
    ['definition', 'definition:object'],
    ['remark', 'remark:note'],
  ].map(([kind, identifier]) => `## ${kind} ${identifier}\n\n### statement\nText.`).join('\n\n')
  const result = convertMarkdown(input)
  for (const label of ['thm:main', 'lem:step', 'pro:claim', 'cor:result', 'asm:model', 'def:object', 'rmk:note']) {
    assert.match(result.latex, new RegExp(`\\\\label\\{${label}\\}`))
  }
  assert.doesNotMatch(result.latex, /\\label\{(?:theorem|lemma|prop|proposition|corollary|assumption|definition|remark):/)
})

test('uses one cleanup option for theorem labels and existing reference prefixes', () => {
  const input = String.raw`## proposition prop:claim

### statement

See \(\mathrm{proposition:source}\), \(\ref{prop:claim}\), and \(\eqref{theorem:main}\).

### proof
Done.`
  const normalized = convertMarkdown(input)
  assert.match(normalized.latex, /\\begin\{proposition\}\\label\{pro:claim\}/)
  assert.match(normalized.latex, /\\ref\{pro:source\}/)
  assert.match(normalized.latex, /\\ref\{pro:claim\}/)
  assert.match(normalized.latex, /\\eqref\{thm:main\}/)

  const preserved = convertMarkdown(input, {
    ...DEFAULT_RENDER_OPTIONS,
    cleanup: { ...DEFAULT_RENDER_OPTIONS.cleanup, normalizeLabelPrefixes: false },
  })
  assert.match(preserved.latex, /\\begin\{proposition\}\\label\{prop:claim\}/)
  assert.match(preserved.latex, /\\ref\{proposition:source\}/)
  assert.match(preserved.latex, /\\ref\{prop:claim\}/)
  assert.match(preserved.latex, /\\eqref\{theorem:main\}/)
})

test('keeps environment boundaries and ordinary headings separate', () => {
  const result = convertMarkdown(`# theorem target

## statement
Target statement.

# Later section
Outside the theorem.`)

  assert.match(result.latex, /\\end\{theorem\}\n\n\\section\*\{Later section\}/)
  assert.ok(result.diagnostics.some(({ code, line }) => code === 'missing-proof' && line === 1))
})

test('normalizes math delimiters without changing math bodies', () => {
  const input = String.raw`Inline \(x_1\) and $y^2$; escaped dollar \$5.

\[
\begin{aligned}
a &= b \\
c &= d
\end{aligned}
\tag{A}
\]`
  const result = convertMarkdown(input, {
    indent: 4,
    inlineMath: 'dollar',
    statementDisplayMath: 'equation',
    outsideDisplayMath: 'equation',
    sectionNumbering: 'unnumbered',
    cleanup: { removeBoxed: true, normalizeLabelPrefixes: true, fontCommandBraces: true, collapseSpaces: true },
    mathSpacing: { enabled: true, relations: true, binaryOperators: true, punctuation: true, compactParentheses: true, pairedBars: true, namedFunctions: true },
  })

  assert.match(result.latex, /Inline \$x_1\$ and \$y\^2\$/)
  assert.match(result.latex, /escaped dollar \\\$5/)
  assert.match(result.latex, /\\begin\{equation\}[\s\S]*\\begin\{aligned\}[\s\S]*\\tag\{A\}[\s\S]*\\end\{equation\}/)
})

test('forces tagged display math to equation in every scope and style', () => {
  const result = convertMarkdown(String.raw`\[
outside \tag*{O}
\]

## proposition tagged

### statement

\[
statement \tag{S}
\]

### proof

\[
proof \tag{P}
\]`, {
    ...DEFAULT_RENDER_OPTIONS,
    statementDisplayMath: 'dollars',
    outsideDisplayMath: 'brackets',
  })

  assert.equal((result.latex.match(/\\begin\{equation\}/g) ?? []).length, 3)
  assert.match(result.latex, /\\begin\{equation\}\\label\{eqn:background-O\}/)
  assert.match(result.latex, /\\begin\{equation\}\\label\{eqn:tagged-S\}/)
  assert.match(result.latex, /\\begin\{equation\}\\label\{eqn:tagged-P\}/)
  assert.doesNotMatch(result.latex, /\\tag(?:\*)?\{[^}]+\} \\label\{eqn:/)
  assert.doesNotMatch(result.latex, /\$\$[\s\S]*\\tag\{/)
  assert.doesNotMatch(result.latex, /\\\[[\s\S]*\\tag\{/)
})

test('labels tagged equations by theorem, proof, and background owner and resolves references', () => {
  const result = convertMarkdown(String.raw`Background (11) is defined below.

\[
b=0 \tag{11}
\]

## theorem thm:main

### statement

Use (10) in the statement.

\[
x=1 \tag{10}
\]

### proof

By (10), the claim follows.

\[
y=2 \tag{12}
\]

Then (12) also holds.`)

  assert.match(result.latex, /\\begin\{equation\}\\label\{eqn:background-11\}/)
  assert.match(result.latex, /Background \\eqref\{eqn:background-11\}/)
  assert.match(result.latex, /\\begin\{equation\}\\label\{eqn:main-10\}/)
  assert.match(result.latex, /Use \\eqref\{eqn:main-10\}/)
  assert.match(result.latex, /By \\eqref\{eqn:main-10\}/)
  assert.match(result.latex, /\\begin\{equation\}\\label\{eqn:main-12\}/)
  assert.match(result.latex, /Then \\eqref\{eqn:main-12\}/)
})

test('keeps unresolved and ambiguous parenthetical numbers unchanged', () => {
  const result = convertMarkdown(String.raw`## lemma lem:first

### statement

\[
x=1 \tag{1}
\]

### proof
Done.

# Background

## lemma lem:second

### statement

\[
y=1 \tag{1}
\]

### proof
Done.

# Outside

Outside (1), missing (99), and year (2025).`)
  assert.match(result.latex, /Outside \(1\), missing \(99\), and year \(2025\)\./)
  assert.ok(result.diagnostics.some(({ code }) => code === 'ambiguous-equation-reference'))
})

test('suffixes duplicate equation labels and refuses ambiguous local references', () => {
  const result = convertMarkdown(String.raw`## theorem thm:duplicate

### statement

\[
x=1 \tag{1}
\]

\[
y=2 \tag{1}
\]

### proof

Neither (1) is unique.`)
  assert.match(result.latex, /\\label\{eqn:duplicate-1\}/)
  assert.match(result.latex, /\\label\{eqn:duplicate-1-2\}/)
  assert.match(result.latex, /Neither \(1\) is unique\./)
  assert.ok(result.diagnostics.some(({ code }) => code === 'duplicate-equation-tag'))
  assert.ok(result.diagnostics.some(({ code }) => code === 'ambiguous-equation-reference'))
})

test('does not rewrite equation-like text inside math, code, or command arguments', () => {
  const result = convertMarkdown(String.raw`\[
x=1 \tag{1}
\]

Plain (1), inline \((1)\), code ` + '`(1)`' + String.raw`, and \texttt{(1)}.`)
  assert.match(result.latex, /Plain \\eqref\{eqn:background-1\}/)
  assert.match(result.latex, /inline \$\(1\)\$/)
  assert.match(result.latex, /\\texttt\{\(1\)\}/)
  assert.match(result.latex, /and \\texttt\{\(1\)\}\./)
})

test('removes boxed commands by default and preserves them when disabled', () => {
  const input = String.raw`Inline \(\boxed{x+\boxed{y}}\).

\[
\boxed{z=1}
\]`
  const removed = convertMarkdown(input)
  assert.doesNotMatch(removed.latex, /\\boxed/)
  assert.match(removed.latex, /\$x \+ y\$/)
  assert.match(removed.latex, /z = 1/)

  const options = { ...DEFAULT_RENDER_OPTIONS, cleanup: { ...DEFAULT_RENDER_OPTIONS.cleanup, removeBoxed: false } }
  const kept = convertMarkdown(input, options)
  assert.match(kept.latex, /\\boxed\{x \+ \\boxed\{y\}\}/)
  assert.match(kept.latex, /\\boxed\{z = 1\}/)
})

test('renders nested lists, bold, italic, code, and plain special characters', () => {
  const result = convertMarkdown(String.raw`- **First** and *second* item
  - Nested \(x_1\)
- Code ` + '`a_b\\c`' + String.raw` and A & B #1.`)

  assert.match(result.latex, /\\begin\{itemize\}[\s\S]*\\textbf\{First\}/)
  assert.match(result.latex, /\\textit\{second\}/)
  assert.doesNotMatch(result.latex, /\\emph\{/)
  assert.ok(result.latex.includes(String.raw`Nested $x_1$`))
  assert.match(result.latex, /\\texttt\{a\\_b\\textbackslash\{\}c\}/)
  assert.match(result.latex, /A \\& B \\#1/)
})

test('uses equation in statements and brackets everywhere else by default', () => {
  const input = String.raw`\[
root-body
\]

## theorem scoped-display

### statement

Inline \(s_1\).

\[
statement-body
\]

- Nested formula:
  \[
  nested-statement-body
  \]

### proof

\[
proof-body
\]

# After the theorem

\[
after-body
\]`

  const result = convertMarkdown(input)

  assert.match(result.latex, /\\\[\n\troot - body\n\\\]/)
  assert.match(result.latex, /\\begin\{equation\}\n\t\tstatement - body\n\t\\end\{equation\}/)
  assert.match(result.latex, /\\begin\{equation\}[\s\S]*nested - statement - body[\s\S]*\\end\{equation\}/)
  assert.match(result.latex, /\\begin\{proof\}[\s\S]*\\\[[\s\S]*\t\tproof - body[\s\S]*\\\][\s\S]*\\end\{proof\}/)
  assert.match(result.latex, /\\section\*\{After the theorem\}[\s\S]*\\\[\n\tafter - body\n\\\]/)
  assert.match(result.latex, /Inline \$s_1\$\./)
})

test('allows statement and outside display styles to be configured independently', () => {
  const input = String.raw`\[
outside-body
\]

## lemma independent

### statement

\[
statement-body
\]`

  const result = convertMarkdown(input, {
    indent: 0,
    inlineMath: 'parentheses',
    statementDisplayMath: 'brackets',
    outsideDisplayMath: 'equation',
    sectionNumbering: 'unnumbered',
    cleanup: { removeBoxed: true, normalizeLabelPrefixes: true, fontCommandBraces: true, collapseSpaces: true },
    mathSpacing: { enabled: true, relations: true, binaryOperators: true, punctuation: true, compactParentheses: true, pairedBars: true, namedFunctions: true },
  })

  assert.match(result.latex, /\\begin\{equation\}\noutside - body\n\\end\{equation\}/)
  assert.match(result.latex, /\\begin\{lemma\}[\s\S]*\\\[\nstatement - body\n\\\][\s\S]*\\end\{lemma\}/)
})

test('applies math spacing to inline and display bodies and honors master off', () => {
  const input = String.raw`Inline \(n<1\).

\[
x*y
\]`
  const formatted = convertMarkdown(input)
  assert.match(formatted.latex, /Inline \$n < 1\$\./)
  assert.match(formatted.latex, /\\\[\n\tx \* y\n\\\]/)

  const untouched = convertMarkdown(input, {
    ...DEFAULT_RENDER_OPTIONS,
    mathSpacing: { ...DEFAULT_RENDER_OPTIONS.mathSpacing, enabled: false },
  })
  assert.match(untouched.latex, /Inline \$n<1\$\./)
  assert.match(untouched.latex, /\\\[\n\tx\*y\n\\\]/)
})

test('renders H1, H2, and H3+ headings with configurable numbering', () => {
  const input = `# Top
## Middle
### Deep
#### Deeper
##### Still deep
###### Deepest`

  const unnumbered = convertMarkdown(input)
  assert.equal(unnumbered.latex, String.raw`\section*{Top}

\subsection*{Middle}

\subsubsection*{Deep}

\subsubsection*{Deeper}

\subsubsection*{Still deep}

\subsubsection*{Deepest}`)

  const numbered = convertMarkdown(input, {
    ...DEFAULT_RENDER_OPTIONS,
    sectionNumbering: 'numbered',
  })
  assert.equal(numbered.latex, String.raw`\section{Top}

\subsection{Middle}

\subsubsection{Deep}

\subsubsection{Deeper}

\subsubsection{Still deep}

\subsubsection{Deepest}`)
})

test('does not turn theorem, statement, or proof markers into numbered sections', () => {
  const result = convertMarkdown(`## lemma section-safe

### statement
Claim.

### proof
Done.`, {
    ...DEFAULT_RENDER_OPTIONS,
    sectionNumbering: 'numbered',
  })

  assert.match(result.latex, /\\begin\{lemma\}[\s\S]*\\begin\{proof\}/)
  assert.doesNotMatch(result.latex, /\\(?:section|subsection|subsubsection)/)
})

const fixtureRoot = '/scratch1/workspace/proof-from-rethlas'
const verifiedFixtures = [
  {
    name: 'krr_generalize',
    path: `${fixtureRoot}/krr_generalize/.rethlas/state/results/krr_generalize/problem/blueprint_verified.md`,
    environments: 10,
    mathSegments: 312,
  },
  {
    name: 'krr_memorize',
    path: `${fixtureRoot}/krr_memorize/.rethlas/state/results/krr_memorize/problem/blueprint_verified.md`,
    environments: 11,
    mathSegments: 315,
  },
  {
    name: 'bo_inexact_reds',
    path: `${fixtureRoot}/bo_inexact_reds/.rethlas/state/results/bo_inexact_reds/problem/blueprint_verified.md`,
    environments: 11,
    mathSegments: 863,
  },
  {
    name: 'nwr_fill_distance',
    path: `${fixtureRoot}/nwr_fill_distance/.rethlas/state/results/nwr_fill_distance/problem/blueprint_verified.md`,
    environments: 14,
    mathSegments: 575,
  },
] as const

function blueprintMathSegments(input: string): string[] {
  const segments: string[] = []
  for (const match of input.matchAll(/\\\(([\s\S]*?)\\\)/g)) segments.push(match[1] ?? '')
  for (const match of input.matchAll(/(^|[^\\])\$([^$\n]+)\$/gm)) segments.push(match[2] ?? '')
  for (const match of input.matchAll(/\\\[([\s\S]*?)\\\]/g)) segments.push(match[1] ?? '')
  for (const match of input.matchAll(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g)) segments.push(match[1] ?? '')
  return segments
}

function normalizedReferenceTokens(value: string): string {
  return value.replace(/\\mathrm\{([^{}]*:[^{}]*)\}/g, '\\ref{$1}')
}

function assertMathSpacingIsStable(input: string): void {
  const tokenPreservingCleanup = {
    ...DEFAULT_MATH_CLEANUP_OPTIONS,
    fontCommandBraces: false,
    collapseSpaces: true,
  }
  for (const segment of blueprintMathSegments(input)) {
    const formatted = formatMathSpacing(segment, DEFAULT_MATH_SPACING_OPTIONS, tokenPreservingCleanup)
    assert.equal(formatted.replace(/\s/g, ''), normalizedReferenceTokens(segment).replace(/\s/g, ''))
    assert.equal(formatMathSpacing(formatted, DEFAULT_MATH_SPACING_OPTIONS, tokenPreservingCleanup), formatted)
    const defaultFormatted = formatMathSpacing(segment)
    assert.equal(formatMathSpacing(defaultFormatted), defaultFormatted)
  }
}

for (const fixture of verifiedFixtures) {
  test(`converts verified blueprint fixture: ${fixture.name}`, { skip: !existsSync(fixture.path) }, () => {
    const input = readFileSync(fixture.path, 'utf8')
    const result = convertMarkdown(input)
    const environmentCount = result.latex.match(/\\begin\{(?:theorem|lemma|proposition|corollary|assumption|definition|remark)\}/g)?.length ?? 0
    const proofCount = result.latex.match(/\\begin\{proof\}/g)?.length ?? 0
    const labelCount = result.latex.match(/\\label\{(?:thm|lem|pro|cor|asm|def|rmk):/g)?.length ?? 0
    const mathSegments = blueprintMathSegments(input)

    assert.equal(environmentCount, fixture.environments)
    assert.equal(proofCount, fixture.environments)
    assert.equal(labelCount, fixture.environments)
    assert.equal(result.diagnostics.length, 0)
    const equationLabels = [...result.latex.matchAll(/\\label\{(eqn:[^}]+)\}/g)].map((match) => match[1])
    assert.equal(equationLabels.length, new Set(equationLabels).size)
    assert.equal(equationLabels.length, result.latex.match(/\\tag(?:\*)?\s*\{/g)?.length ?? 0)
    if (fixture.name === 'krr_generalize') {
      assert.match(result.latex, /\\ref\{lem:operator-identities\}/)
      assert.doesNotMatch(result.latex, /\\mathrm\{lem:operator-identities\}/)
    }
    assert.equal(mathSegments.length, fixture.mathSegments)
    assertMathSpacingIsStable(input)
    assert.doesNotMatch(result.latex, /(^|\n)\s*#{1,6}\s+/)
    assert.doesNotMatch(result.latex, /\\documentclass|\\begin\{document\}/)
  })
}
